#!/usr/bin/env node
import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { Command } from "commander";

import { CloudflareApiClient } from "./lib/cloudflare-api.js";
import {
  decryptSnapshotPayload,
  encryptSnapshotPayload,
  generateEncryptionSecret,
  isEncryptedSnapshotPayload
} from "./lib/encryption.js";
import { exists } from "./lib/fs-utils.js";
import { parseEnvFile, serializeEnvFile, writeEnvFileAtomic, writeTextFileAtomic } from "./lib/env-file.js";
import { checksumEntries, makeVersionId } from "./lib/hash.js";
import {
  currentPointerKey,
  flatEnvMetaKey,
  flatEnvVarKey,
  flatEnvVarsPrefix,
  versionKey,
  versionsPrefix
} from "./lib/kv-keys.js";
import { listLocalLinks, loadLocalConfig, requireLocalConfig, setDefaultLocalLink, upsertLocalLink } from "./lib/local-config.js";
import { getProfile, listProfileNames, upsertProfile } from "./lib/profiles.js";
import { getWranglerAccessToken, getWranglerAccountId } from "./lib/wrangler-auth.js";
import type { CfenvProfile, CurrentPointer, FlatEnvMetadata, ProjectLink, RemoteSnapshot } from "./types.js";

const require = createRequire(import.meta.url);

function resolveCliVersion(): string {
  try {
    const packageJson = require("../package.json") as { version?: string };
    if (typeof packageJson.version === "string" && packageJson.version.trim()) {
      return packageJson.version;
    }
  } catch {
    // noop: fall through to safe default
  }
  return "0.0.0";
}

const VERSION = resolveCliVersion();
const MAX_KV_VALUE_SIZE_BYTES = 25 * 1024 * 1024;
type StorageMode = "flat" | "snapshot";
type ExportFormat = "dotenv" | "json";

function nowIso(): string {
  return new Date().toISOString();
}

function resolveUpdatedBy(input?: string): string {
  if (input?.trim()) {
    return input.trim();
  }
  const user = os.userInfo().username;
  const host = os.hostname();
  return `${user}@${host}`;
}

function resolveEncryptionSecret(secretOption?: string): string | undefined {
  return secretOption ?? process.env.CFENV_ENCRYPTION_KEY;
}

function parseStorageMode(raw: string | undefined, defaultValue: StorageMode): StorageMode {
  const value = (raw ?? defaultValue).trim().toLowerCase();
  if (value === "flat" || value === "snapshot") {
    return value;
  }
  throw new Error(`Invalid storage mode "${raw}". Use "flat" or "snapshot".`);
}

function parseExportFormat(raw: string | undefined): ExportFormat {
  const value = (raw ?? "dotenv").trim().toLowerCase();
  if (value === "dotenv" || value === "json") {
    return value;
  }
  throw new Error(`Invalid export format "${raw}". Use "dotenv" or "json".`);
}

async function resolveCloudflareAuth(input: {
  accountId?: string;
  apiToken?: string;
  fromWrangler?: boolean;
}): Promise<{
  accountId: string;
  apiToken: string;
  authSource: CfenvProfile["authSource"];
}> {
  const fromWrangler = Boolean(input.fromWrangler);
  const accountId = input.accountId ?? (fromWrangler ? await getWranglerAccountId() : undefined);
  if (!accountId) {
    throw new Error("Missing account ID. Pass --account-id or use Wrangler auth.");
  }

  const apiToken = fromWrangler
    ? await getWranglerAccessToken()
    : input.apiToken ?? process.env.CLOUDFLARE_API_TOKEN;

  if (!apiToken) {
    throw new Error("Missing API token. Pass --api-token, set CLOUDFLARE_API_TOKEN, or use Wrangler auth.");
  }

  return {
    accountId,
    apiToken,
    authSource: fromWrangler ? "wrangler" : "api-token"
  };
}

async function validateCloudflareAuth(input: {
  client: CloudflareApiClient;
  authSource: CfenvProfile["authSource"];
}): Promise<void> {
  if (input.authSource === "api-token") {
    const tokenStatus = await input.client.verifyToken();
    if (tokenStatus.status.toLowerCase() !== "active") {
      throw new Error(`Cloudflare token is not active (status: ${tokenStatus.status}).`);
    }
    return;
  }

  // Wrangler OAuth tokens are valid for API calls but are not compatible with /user/tokens/verify.
  await input.client.listNamespaces(1);
}

function resolveOperationMode(link: ProjectLink, modeOverride?: string): StorageMode {
  const defaultMode: StorageMode = parseStorageMode(link.storageMode, "flat");
  return parseStorageMode(modeOverride, defaultMode);
}

async function pushFlatEntries(input: {
  client: CloudflareApiClient;
  link: ProjectLink;
  entries: Record<string, string>;
  checksum: string;
  updatedAt: string;
  updatedBy: string;
}): Promise<void> {
  const prefix = flatEnvVarsPrefix(input.link);
  const existingKeys = await input.client.listKeys(input.link.namespaceId, prefix);
  const existingVarNames = new Set(
    existingKeys
      .map((item) => item.name)
      .filter((name) => name.startsWith(prefix))
      .map((name) => name.slice(prefix.length))
      .filter(Boolean)
  );

  const nextVarNames = new Set(Object.keys(input.entries));

  for (const [envVarName, envVarValue] of Object.entries(input.entries)) {
    await input.client.putValue(input.link.namespaceId, flatEnvVarKey(input.link, envVarName), envVarValue);
  }

  for (const envVarName of existingVarNames) {
    if (!nextVarNames.has(envVarName)) {
      await input.client.deleteValue(input.link.namespaceId, flatEnvVarKey(input.link, envVarName));
    }
  }

  const metadata: FlatEnvMetadata = {
    schema: 1,
    mode: "flat",
    checksum: input.checksum,
    updatedAt: input.updatedAt,
    updatedBy: input.updatedBy,
    entriesCount: Object.keys(input.entries).length
  };
  await input.client.putValue(input.link.namespaceId, flatEnvMetaKey(input.link), JSON.stringify(metadata));

  // Cleanup legacy snapshot-mode keys for the same project/environment to keep KV layout simple.
  const snapshotPointer = currentPointerKey(input.link);
  await input.client.deleteValue(input.link.namespaceId, snapshotPointer).catch(() => undefined);

  const snapshotVersionKeys = await input.client.listKeys(input.link.namespaceId, versionsPrefix(input.link));
  for (const item of snapshotVersionKeys) {
    await input.client.deleteValue(input.link.namespaceId, item.name);
  }
}

async function pullFlatEntries(input: {
  client: CloudflareApiClient;
  link: ProjectLink;
}): Promise<{
  entries: Record<string, string>;
  encrypted: boolean;
}> {
  const prefix = flatEnvVarsPrefix(input.link);
  const keys = await input.client.listKeys(input.link.namespaceId, prefix);
  const envVarKeys = keys
    .map((item) => item.name)
    .filter((name) => name.startsWith(prefix))
    .sort((a, b) => a.localeCompare(b));

  if (!envVarKeys.length) {
    throw new Error("No env variables found in KV for flat storage mode.");
  }

  const entries: Record<string, string> = {};
  for (const fullKey of envVarKeys) {
    const envVarName = fullKey.slice(prefix.length);
    const envVarValue = await input.client.getValue(input.link.namespaceId, fullKey);
    if (envVarValue !== null) {
      entries[envVarName] = envVarValue;
    }
  }

  if (!Object.keys(entries).length) {
    throw new Error("No env variable values found in KV for flat storage mode.");
  }

  return {
    entries,
    encrypted: false
  };
}

async function pushSnapshotEntries(input: {
  client: CloudflareApiClient;
  link: ProjectLink;
  entries: Record<string, string>;
  checksum: string;
  updatedAt: string;
  updatedBy: string;
  encryptionSecret?: string;
  encrypt: boolean;
}): Promise<{
  versionId: string;
}> {
  if (input.encrypt && !input.encryptionSecret?.trim()) {
    throw new Error(
      "Missing encryption secret. Pass --encryption-key or set CFENV_ENCRYPTION_KEY. Use --no-encrypt to bypass."
    );
  }

  const versionId = makeVersionId();
  const snapshot: RemoteSnapshot = {
    schema: 1,
    versionId,
    project: input.link.project,
    environment: input.link.environment,
    checksum: input.checksum,
    updatedAt: input.updatedAt,
    updatedBy: input.updatedBy,
    entries: input.entries
  };
  const pointer: CurrentPointer = {
    schema: 1,
    versionId,
    checksum: input.checksum,
    updatedAt: input.updatedAt,
    updatedBy: input.updatedBy,
    entriesCount: Object.keys(input.entries).length,
    encrypted: input.encrypt
  };

  const snapshotText = JSON.stringify(snapshot);
  const storagePayload = input.encrypt ? encryptSnapshotPayload(snapshotText, input.encryptionSecret ?? "") : snapshotText;
  if (Buffer.byteLength(storagePayload, "utf8") > MAX_KV_VALUE_SIZE_BYTES) {
    throw new Error("Snapshot exceeds Cloudflare KV 25 MiB value limit.");
  }

  await input.client.putValue(input.link.namespaceId, versionKey(input.link, versionId), storagePayload);
  await input.client.putValue(input.link.namespaceId, currentPointerKey(input.link), JSON.stringify(pointer));

  return { versionId };
}

async function pullSnapshotEntries(input: {
  client: CloudflareApiClient;
  link: ProjectLink;
  encryptionSecret?: string;
  versionId?: string;
}): Promise<{
  entries: Record<string, string>;
  versionId: string;
  encrypted: boolean;
  project: string;
  environment: string;
}> {
  let versionId = input.versionId;
  if (!versionId) {
    const currentRaw = await input.client.getValue(input.link.namespaceId, currentPointerKey(input.link));
    if (!currentRaw) {
      throw new Error("No current pointer found in KV. Push once first.");
    }
    const pointer = JSON.parse(currentRaw) as CurrentPointer;
    versionId = pointer.versionId;
  }

  const snapshotRaw = await input.client.getValue(input.link.namespaceId, versionKey(input.link, versionId));
  if (!snapshotRaw) {
    throw new Error(`Snapshot version "${versionId}" not found.`);
  }
  const encrypted = isEncryptedSnapshotPayload(snapshotRaw);
  const snapshotPayload = decryptSnapshotPayload(snapshotRaw, input.encryptionSecret);
  const snapshot = JSON.parse(snapshotPayload) as RemoteSnapshot;

  const computedChecksum = checksumEntries(snapshot.entries);
  if (computedChecksum !== snapshot.checksum) {
    throw new Error("Snapshot checksum mismatch. Refusing to write potentially corrupted env file.");
  }

  return {
    entries: snapshot.entries,
    versionId: snapshot.versionId,
    encrypted,
    project: snapshot.project,
    environment: snapshot.environment
  };
}

function unwrapError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function runAction<T>(fn: (options: T) => Promise<void>) {
  return async (options: T) => {
    try {
      await fn(options);
    } catch (error) {
      console.error(`Error: ${unwrapError(error)}`);
      process.exitCode = 1;
    }
  };
}

async function getApiClient(profileName?: string): Promise<{ profile: Awaited<ReturnType<typeof getProfile>>; client: CloudflareApiClient }> {
  const profile = await getProfile(profileName);
  const authSource = profile.authSource ?? "api-token";
  const apiToken =
    authSource === "wrangler"
      ? await getWranglerAccessToken()
      : profile.apiToken ?? process.env.CLOUDFLARE_API_TOKEN;

  if (!apiToken) {
    throw new Error(`Profile "${profile.name}" has no API token configured.`);
  }

  const client = new CloudflareApiClient({
    accountId: profile.accountId,
    apiToken
  });
  return { profile, client };
}

const program = new Command();

program
  .name("cfenv")
  .description("Cloudflare KV-backed environment sync tool")
  .version(VERSION);

program
  .command("keygen")
  .description("Generate a strong CFENV_ENCRYPTION_KEY value")
  .option("--length <bytes>", "Random bytes before base64url encoding", "32")
  .option("--raw", "Print only the key value", false)
  .action(
    runAction<{
      length: string;
      raw: boolean;
    }>(async (options) => {
      const byteLength = Number(options.length);
      if (!Number.isInteger(byteLength)) {
        throw new Error("--length must be an integer.");
      }
      const secret = generateEncryptionSecret(byteLength);
      if (options.raw) {
        console.log(secret);
        return;
      }
      console.log(`export CFENV_ENCRYPTION_KEY='${secret}'`);
    })
  );

program
  .command("setup")
  .description("One-step setup: auth profile + namespace + local project link")
  .requiredOption("--project <name>", "Project name")
  .requiredOption("--env <name>", "Environment name (development, preview, production)")
  .option("--profile <name>", "Profile name", "default")
  .option("--key-prefix <prefix>", "KV key prefix", "cfenv")
  .option("--mode <mode>", "Storage mode: flat or snapshot", "flat")
  .option("--namespace-id <id>", "Existing Cloudflare KV namespace ID")
  .option("--namespace-name <name>", "KV namespace title (auto-create if missing)")
  .option("--account-id <id>", "Cloudflare account ID")
  .option("--api-token <token>", "Cloudflare API token")
  .option("--no-from-wrangler", "Use API token/CLOUDFLARE_API_TOKEN instead of Wrangler auth")
  .option("--no-set-default", "Do not set this profile as default")
  .action(
    runAction<{
      project: string;
      env: string;
      profile: string;
      keyPrefix: string;
      mode: string;
      namespaceId?: string;
      namespaceName?: string;
      accountId?: string;
      apiToken?: string;
      fromWrangler: boolean;
      setDefault: boolean;
    }>(async (options) => {
      const { accountId, apiToken, authSource } = await resolveCloudflareAuth({
        accountId: options.accountId,
        apiToken: options.apiToken,
        fromWrangler: options.fromWrangler
      });
      const storageMode = parseStorageMode(options.mode, "flat");

      const client = new CloudflareApiClient({
        accountId,
        apiToken
      });
      await validateCloudflareAuth({ client, authSource });

      const profile: CfenvProfile = {
        name: options.profile,
        accountId,
        apiToken: authSource === "api-token" ? apiToken : undefined,
        authSource,
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
      await upsertProfile(profile, options.setDefault);

      const namespaceTitle = options.namespaceName ?? `cfenv-${options.project}`;
      let namespaceId = options.namespaceId;
      let namespaceCreated = false;

      if (!namespaceId) {
        const namespaces = await client.listNamespaces();
        const existing = namespaces.find((item) => item.title === namespaceTitle);
        if (existing) {
          namespaceId = existing.id;
        } else {
          const created = await client.createNamespace(namespaceTitle);
          namespaceId = created.id;
          namespaceCreated = true;
        }
      }

      if (!namespaceId) {
        throw new Error("Unable to resolve KV namespace ID.");
      }

      const link: ProjectLink = {
        version: 1,
        profile: options.profile,
        namespaceId,
        keyPrefix: options.keyPrefix,
        project: options.project,
        environment: options.env,
        storageMode
      };
      await upsertLocalLink(link, { setAsDefault: options.setDefault });

      console.log(`Setup complete for ${options.project}/${options.env}.`);
      console.log(`Profile: ${options.profile} (auth=${authSource})`);
      console.log(`Storage mode: ${storageMode}`);
      console.log(`Account: ${accountId}`);
      console.log(`Namespace: ${namespaceId}${options.namespaceId ? " (provided)" : namespaceCreated ? " (created)" : " (existing)"}`);
      if (!options.namespaceId) {
        console.log(`Namespace title: ${namespaceTitle}`);
      }
      console.log(`Local config: ${path.join(process.cwd(), ".cfenv", "config.json")}`);
    })
  );

program
  .command("login")
  .description("Store Cloudflare auth profile for cfenv")
  .option("--profile <name>", "Profile name", "default")
  .option("--account-id <id>", "Cloudflare account ID")
  .option("--api-token <token>", "Cloudflare API token")
  .option("--from-wrangler", "Use current Wrangler auth session for this profile", false)
  .option("--no-set-default", "Do not set this profile as default")
  .action(
    runAction<{
      profile: string;
      accountId?: string;
      apiToken?: string;
      fromWrangler: boolean;
      setDefault: boolean;
    }>(async (options) => {
      const { accountId, apiToken, authSource } = await resolveCloudflareAuth({
        accountId: options.accountId,
        apiToken: options.apiToken,
        fromWrangler: options.fromWrangler
      });

      const client = new CloudflareApiClient({
        accountId,
        apiToken
      });
      await validateCloudflareAuth({ client, authSource });

      const profile: CfenvProfile = {
        name: options.profile,
        accountId,
        apiToken: authSource === "api-token" ? apiToken : undefined,
        authSource,
        createdAt: nowIso(),
        updatedAt: nowIso()
      };

      await upsertProfile(profile, options.setDefault);
      console.log(
        `Saved profile "${options.profile}" for account ${accountId} (auth=${authSource}).`
      );
    })
  );

program
  .command("profiles")
  .description("List configured cfenv profiles")
  .action(
    runAction<Record<string, never>>(async () => {
      const names = await listProfileNames();
      if (!names.length) {
        console.log("No profiles configured. Run `cfenv login`.");
        return;
      }
      for (const name of names) {
        console.log(name);
      }
    })
  );

program
  .command("targets")
  .description("List local project/environment targets configured in this repository")
  .action(
    runAction<Record<string, never>>(async () => {
      const config = await loadLocalConfig();
      const links = await listLocalLinks();
      if (!links.length) {
        console.log("No local targets configured. Run `cfenv setup` or `cfenv link` first.");
        return;
      }

      for (const link of links) {
        const key = `${link.project}:${link.environment}`;
        const marker = config?.defaultLinkKey === key ? "*" : " ";
        console.log(
          `${marker} ${link.project}/${link.environment} | mode=${link.storageMode ?? "flat"} | ns=${link.namespaceId} | profile=${link.profile}`
        );
      }
      console.log("* = default target");
    })
  );

program
  .command("use")
  .description("Set the default local environment target")
  .requiredOption("--env <name>", "Environment name")
  .option("--project <name>", "Optional project name when env is ambiguous")
  .action(
    runAction<{
      env: string;
      project?: string;
    }>(async (options) => {
      const selected = await setDefaultLocalLink({
        environment: options.env,
        project: options.project
      });
      console.log(`Default target set to ${selected.project}/${selected.environment}.`);
    })
  );

program
  .command("link")
  .description("Link this directory to a Cloudflare KV namespace/project/env")
  .requiredOption("--project <name>", "Project name")
  .requiredOption("--env <name>", "Environment name (development, preview, production)")
  .requiredOption("--namespace-id <id>", "Cloudflare KV namespace ID")
  .option("--profile <name>", "Profile to use", "default")
  .option("--key-prefix <prefix>", "KV key prefix", "cfenv")
  .option("--mode <mode>", "Storage mode: flat or snapshot", "flat")
  .option("--no-set-default", "Do not set this target as default")
  .action(
    runAction<{
      project: string;
      env: string;
      namespaceId: string;
      profile: string;
      keyPrefix: string;
      mode: string;
      setDefault: boolean;
    }>(async (options) => {
      await getProfile(options.profile);
      const storageMode = parseStorageMode(options.mode, "flat");

      const link: ProjectLink = {
        version: 1,
        profile: options.profile,
        namespaceId: options.namespaceId,
        keyPrefix: options.keyPrefix,
        project: options.project,
        environment: options.env,
        storageMode
      };

      await upsertLocalLink(link, { setAsDefault: options.setDefault });
      console.log(`Linked ${options.project}/${options.env} to namespace ${options.namespaceId}.`);
      console.log(`Storage mode: ${storageMode}`);
      console.log(`Config saved to ${path.join(process.cwd(), ".cfenv", "config.json")}.`);
    })
  );

program
  .command("push")
  .description("Push a local .env file to Cloudflare KV")
  .option("--profile <name>", "Profile override")
  .option("--project <name>", "Project override from local config")
  .option("--env <name>", "Environment override from local config")
  .option("--file <path>", "Path to source env file", ".env")
  .option("--mode <mode>", "Storage mode override: flat or snapshot")
  .option("--updated-by <name>", "Actor label for metadata")
  .option("--encryption-key <secret>", "Encryption secret (snapshot mode only). Defaults to CFENV_ENCRYPTION_KEY")
  .option("--no-encrypt", "Store snapshot in plaintext (not recommended)")
  .action(
    runAction<{
      profile?: string;
      project?: string;
      env?: string;
      file: string;
      mode?: string;
      updatedBy?: string;
      encryptionKey?: string;
      encrypt: boolean;
    }>(async (options) => {
      const link = await requireLocalConfig({
        project: options.project,
        environment: options.env
      });
      const { profile, client } = await getApiClient(options.profile ?? link.profile);
      const entries = await parseEnvFile(options.file);
      const mode = resolveOperationMode(link, options.mode);
      const updatedAt = nowIso();
      const updatedBy = resolveUpdatedBy(options.updatedBy);
      const checksum = checksumEntries(entries);
      const encryptionSecret = resolveEncryptionSecret(options.encryptionKey);
      if (mode === "flat") {
        await pushFlatEntries({
          client,
          link,
          entries,
          checksum,
          updatedAt,
          updatedBy
        });
        console.log(
          [
            `Pushed ${Object.keys(entries).length} keys`,
            `project=${link.project}`,
            `env=${link.environment}`,
            `mode=flat`,
            `profile=${profile.name}`
          ].join(" | ")
        );
        return;
      }

      const result = await pushSnapshotEntries({
        client,
        link,
        entries,
        checksum,
        updatedAt,
        updatedBy,
        encryptionSecret,
        encrypt: options.encrypt
      });
      console.log(
        [
          `Pushed ${Object.keys(entries).length} keys`,
          `project=${link.project}`,
          `env=${link.environment}`,
          `version=${result.versionId}`,
          `mode=snapshot`,
          `profile=${profile.name}`,
          `encrypted=${options.encrypt ? "yes" : "no"}`
        ].join(" | ")
      );
    })
  );

program
  .command("pull")
  .description("Pull env variables from Cloudflare KV")
  .option("--profile <name>", "Profile override")
  .option("--project <name>", "Project override from local config")
  .option("--env <name>", "Environment override from local config")
  .option("--mode <mode>", "Storage mode override: flat or snapshot")
  .option("--version <id>", "Version ID to pull (snapshot mode only; defaults to latest pointer)")
  .option("--out <path>", "Output file path", ".env")
  .option("--encryption-key <secret>", "Encryption secret (snapshot mode only). Defaults to CFENV_ENCRYPTION_KEY")
  .option("--overwrite", "Overwrite output file if it already exists", false)
  .action(
    runAction<{
      profile?: string;
      project?: string;
      env?: string;
      mode?: string;
      version?: string;
      out: string;
      encryptionKey?: string;
      overwrite: boolean;
    }>(async (options) => {
      const link = await requireLocalConfig({
        project: options.project,
        environment: options.env
      });
      const { profile, client } = await getApiClient(options.profile ?? link.profile);
      const mode = resolveOperationMode(link, options.mode);
      const outputPath = path.resolve(options.out);
      const encryptionSecret = resolveEncryptionSecret(options.encryptionKey);

      if (!options.overwrite && (await exists(outputPath))) {
        throw new Error(`Output path already exists: ${outputPath}. Use --overwrite to replace it.`);
      }

      if (mode === "flat") {
        const pulled = await pullFlatEntries({ client, link });
        const serialized = serializeEnvFile(pulled.entries);
        await writeEnvFileAtomic(outputPath, serialized);
        if (process.platform !== "win32") {
          await fs.chmod(outputPath, 0o600).catch(() => undefined);
        }
        console.log(
          [
            `Pulled ${Object.keys(pulled.entries).length} keys`,
            `project=${link.project}`,
            `env=${link.environment}`,
            `mode=flat`,
            `profile=${profile.name}`,
            `out=${outputPath}`
          ].join(" | ")
        );
        return;
      }

      const pulled = await pullSnapshotEntries({
        client,
        link,
        encryptionSecret,
        versionId: options.version
      });
      const serialized = serializeEnvFile(pulled.entries);
      await writeEnvFileAtomic(outputPath, serialized);
      if (process.platform !== "win32") {
        await fs.chmod(outputPath, 0o600).catch(() => undefined);
      }

      console.log(
        [
          `Pulled ${Object.keys(pulled.entries).length} keys`,
          `project=${pulled.project}`,
          `env=${pulled.environment}`,
          `version=${pulled.versionId}`,
          `mode=snapshot`,
          `profile=${profile.name}`,
          `out=${outputPath}`,
          `encrypted=${pulled.encrypted ? "yes" : "no"}`
        ].join(" | ")
      );
    })
  );

program
  .command("export")
  .description("Export env values for CI/runtime integration")
  .option("--profile <name>", "Profile override")
  .option("--project <name>", "Project override from local config")
  .option("--env <name>", "Environment override from local config")
  .option("--mode <mode>", "Storage mode override: flat or snapshot")
  .option("--version <id>", "Version ID to export (snapshot mode only)")
  .option("--encryption-key <secret>", "Encryption secret (snapshot mode only). Defaults to CFENV_ENCRYPTION_KEY")
  .option("--format <format>", "Output format: dotenv or json", "dotenv")
  .option("--out <path>", "Write output to file")
  .option("--stdout", "Always print output to stdout", false)
  .option("--overwrite", "Overwrite --out file if it exists", false)
  .action(
    runAction<{
      profile?: string;
      project?: string;
      env?: string;
      mode?: string;
      version?: string;
      encryptionKey?: string;
      format: string;
      out?: string;
      stdout: boolean;
      overwrite: boolean;
    }>(async (options) => {
      const link = await requireLocalConfig({
        project: options.project,
        environment: options.env
      });
      const { profile, client } = await getApiClient(options.profile ?? link.profile);
      const mode = resolveOperationMode(link, options.mode);
      const encryptionSecret = resolveEncryptionSecret(options.encryptionKey);
      const format = parseExportFormat(options.format);

      let entries: Record<string, string>;
      if (mode === "flat") {
        const pulled = await pullFlatEntries({ client, link });
        entries = pulled.entries;
      } else {
        const pulled = await pullSnapshotEntries({
          client,
          link,
          encryptionSecret,
          versionId: options.version
        });
        entries = pulled.entries;
      }

      const outputContent = format === "dotenv"
        ? serializeEnvFile(entries)
        : `${JSON.stringify(entries, null, 2)}\n`;

      const outPath = options.out ? path.resolve(options.out) : undefined;
      if (outPath) {
        if (!options.overwrite && (await exists(outPath))) {
          throw new Error(`Output path already exists: ${outPath}. Use --overwrite to replace it.`);
        }
        await writeTextFileAtomic(outPath, outputContent);
        if (process.platform !== "win32") {
          await fs.chmod(outPath, 0o600).catch(() => undefined);
        }
      }

      const shouldWriteStdout = options.stdout || !options.out;
      if (shouldWriteStdout) {
        process.stdout.write(outputContent);
        return;
      }

      console.log(
        [
          `Exported ${Object.keys(entries).length} keys`,
          `project=${link.project}`,
          `env=${link.environment}`,
          `mode=${mode}`,
          `profile=${profile.name}`,
          `format=${format}`,
          `out=${outPath}`
        ].join(" | ")
      );
    })
  );

program
  .command("history")
  .description("List snapshot versions or flat metadata for the linked project/environment")
  .option("--profile <name>", "Profile override")
  .option("--project <name>", "Project override from local config")
  .option("--env <name>", "Environment override from local config")
  .option("--mode <mode>", "Storage mode override: flat or snapshot")
  .option("--limit <n>", "Maximum versions to show", "20")
  .action(
    runAction<{
      profile?: string;
      project?: string;
      env?: string;
      mode?: string;
      limit: string;
    }>(async (options) => {
      const link = await requireLocalConfig({
        project: options.project,
        environment: options.env
      });
      const { client } = await getApiClient(options.profile ?? link.profile);
      const mode = resolveOperationMode(link, options.mode);

      if (mode === "flat") {
        const metaRaw = await client.getValue(link.namespaceId, flatEnvMetaKey(link));
        if (!metaRaw) {
          console.log("No flat metadata found.");
          return;
        }
        const metadata = JSON.parse(metaRaw) as FlatEnvMetadata;
        console.log(
          [
            `mode=flat`,
            `updatedAt=${metadata.updatedAt}`,
            `updatedBy=${metadata.updatedBy ?? "unknown"}`,
            `entries=${metadata.entriesCount}`,
            `checksum=${metadata.checksum}`
          ].join(" | ")
        );
        return;
      }

      const prefix = versionsPrefix(link);
      const keys = await client.listKeys(link.namespaceId, prefix);
      const versionIds = keys
        .map((key) => key.name)
        .filter((name) => name.startsWith(prefix))
        .map((name) => name.slice(prefix.length))
        .filter(Boolean)
        .sort((a, b) => b.localeCompare(a))
        .slice(0, Number(options.limit));

      if (!versionIds.length) {
        console.log("No versions found.");
        return;
      }

      for (const id of versionIds) {
        console.log(id);
      }
    })
  );

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(`Error: ${unwrapError(error)}`);
  process.exitCode = 1;
});
