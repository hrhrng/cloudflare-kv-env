import { CloudflareApiClient } from "../lib/cloudflare-api.js";
import { checksumEntries } from "../lib/hash.js";
import { flatEnvMetaKey, flatEnvVarsPrefix } from "../lib/kv-keys.js";
import type { FlatEnvMetadata, ProjectLink } from "../types.js";

interface HotUpdateApiClient {
  getValue(namespaceId: string, key: string): Promise<string | null>;
  listKeys(namespaceId: string, prefix: string, limit?: number): Promise<Array<{ name: string }>>;
}

export interface HotUpdateSnapshot {
  project: string;
  environment: string;
  namespaceId: string;
  checksum: string;
  updatedAt: string;
  updatedBy?: string;
  entriesCount: number;
  entries: Record<string, string>;
}

export interface CfenvHotUpdateClientOptions {
  accountId: string;
  apiToken: string;
  namespaceId: string;
  project: string;
  environment: string;
  keyPrefix?: string;
  intervalMs?: number;
  maxIntervalMs?: number;
  bootstrap?: boolean;
  onUpdate?: (snapshot: HotUpdateSnapshot, reason: "initial" | "changed") => void | Promise<void>;
  onError?: (error: Error) => void | Promise<void>;
  client?: HotUpdateApiClient;
}

const DEFAULT_INTERVAL_MS = 30_000;
const DEFAULT_MAX_INTERVAL_MS = 300_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  return new Error(String(value));
}

function buildLink(options: CfenvHotUpdateClientOptions): ProjectLink {
  return {
    version: 1,
    profile: "sdk",
    namespaceId: options.namespaceId,
    keyPrefix: options.keyPrefix ?? "cfenv",
    project: options.project,
    environment: options.environment,
    storageMode: "flat"
  };
}

export class CfenvHotUpdateClient {
  private readonly options: CfenvHotUpdateClientOptions;
  private readonly client: HotUpdateApiClient;
  private readonly link: ProjectLink;
  private readonly intervalMs: number;
  private readonly maxIntervalMs: number;
  private readonly bootstrap: boolean;

  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private consecutiveErrors = 0;
  private lastChecksum: string | undefined;
  private lastSnapshot: HotUpdateSnapshot | null = null;

  constructor(options: CfenvHotUpdateClientOptions) {
    this.options = options;
    this.client = options.client ?? new CloudflareApiClient({
      accountId: options.accountId,
      apiToken: options.apiToken
    });
    this.link = buildLink(options);
    this.intervalMs = Math.max(1_000, options.intervalMs ?? DEFAULT_INTERVAL_MS);
    this.maxIntervalMs = Math.max(this.intervalMs, options.maxIntervalMs ?? DEFAULT_MAX_INTERVAL_MS);
    this.bootstrap = options.bootstrap ?? true;
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    if (this.bootstrap) {
      await this.refreshOnce("initial");
    }
    this.schedule(this.intervalMs);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  getSnapshot(): HotUpdateSnapshot | null {
    return this.lastSnapshot;
  }

  async refreshOnce(reason: "initial" | "changed" = "changed"): Promise<boolean> {
    const snapshot = await this.fetchSnapshot();
    const changed = snapshot.checksum !== this.lastChecksum;

    if (!changed) {
      return false;
    }

    this.lastChecksum = snapshot.checksum;
    this.lastSnapshot = snapshot;

    if (this.options.onUpdate) {
      await this.options.onUpdate(snapshot, reason);
    }

    return true;
  }

  private schedule(delayMs: number): void {
    if (!this.running) {
      return;
    }

    this.timer = setTimeout(async () => {
      if (!this.running) {
        return;
      }

      try {
        await this.refreshOnce("changed");
        this.consecutiveErrors = 0;
        this.schedule(this.intervalMs);
      } catch (error) {
        this.consecutiveErrors += 1;
        const nextDelay = Math.min(
          this.maxIntervalMs,
          this.intervalMs * 2 ** Math.min(this.consecutiveErrors, 6)
        );

        if (this.options.onError) {
          await this.options.onError(toError(error));
        }

        await sleep(0);
        this.schedule(nextDelay);
      }
    }, delayMs);
  }

  private async fetchSnapshot(): Promise<HotUpdateSnapshot> {
    const metaRaw = await this.client.getValue(this.link.namespaceId, flatEnvMetaKey(this.link));
    if (!metaRaw) {
      throw new Error("No flat metadata found in KV for hot update.");
    }

    let metadata: FlatEnvMetadata;
    try {
      metadata = JSON.parse(metaRaw) as FlatEnvMetadata;
    } catch {
      throw new Error("Invalid flat metadata payload.");
    }

    const prefix = flatEnvVarsPrefix(this.link);
    const keys = await this.client.listKeys(this.link.namespaceId, prefix);
    const envVarKeys = keys
      .map((item) => item.name)
      .filter((name) => name.startsWith(prefix))
      .sort((a, b) => a.localeCompare(b));

    const entries: Record<string, string> = {};
    for (const fullKey of envVarKeys) {
      const envVarName = fullKey.slice(prefix.length);
      const envVarValue = await this.client.getValue(this.link.namespaceId, fullKey);
      if (envVarValue !== null) {
        entries[envVarName] = envVarValue;
      }
    }

    const computedChecksum = checksumEntries(entries);
    if (computedChecksum !== metadata.checksum) {
      throw new Error("Hot update checksum mismatch.");
    }

    return {
      project: this.link.project,
      environment: this.link.environment,
      namespaceId: this.link.namespaceId,
      checksum: metadata.checksum,
      updatedAt: metadata.updatedAt,
      updatedBy: metadata.updatedBy,
      entriesCount: metadata.entriesCount,
      entries
    };
  }
}

export function applyEntriesToProcessEnv(
  entries: Record<string, string>,
  options: {
    overwrite?: boolean;
  } = {}
): void {
  const overwrite = options.overwrite ?? true;
  for (const [key, value] of Object.entries(entries)) {
    if (!overwrite && process.env[key] !== undefined) {
      continue;
    }
    process.env[key] = value;
  }
}
