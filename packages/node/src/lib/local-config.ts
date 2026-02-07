import { promises as fs } from "node:fs";

import type { LocalConfigFile, ProjectLink } from "../types.js";
import { ensurePrivateDir, exists, writePrivateFile } from "./fs-utils.js";
import { getLocalConfigDir, getLocalConfigPath } from "./paths.js";

function makeLinkKey(project: string, environment: string): string {
  return `${project}:${environment}`;
}

function assertStringField(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid local config: "${field}" must be a non-empty string.`);
  }
  return value;
}

function parseProjectLink(raw: unknown): ProjectLink {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid local config: link entry must be an object.");
  }
  const record = raw as Record<string, unknown>;
  const storageModeRaw = record.storageMode;
  const storageMode =
    storageModeRaw === "snapshot" || storageModeRaw === "flat" ? storageModeRaw : undefined;

  return {
    version: 1,
    profile: assertStringField(record, "profile"),
    namespaceId: assertStringField(record, "namespaceId"),
    keyPrefix: assertStringField(record, "keyPrefix"),
    project: assertStringField(record, "project"),
    environment: assertStringField(record, "environment"),
    storageMode
  };
}

function normalizeConfig(raw: unknown): LocalConfigFile {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid local config format.");
  }

  const parsed = raw as Record<string, unknown>;
  if (parsed.version === 2 && typeof parsed.links === "object" && parsed.links !== null) {
    const linksRaw = parsed.links as Record<string, unknown>;
    const links: Record<string, ProjectLink> = {};
    for (const [key, value] of Object.entries(linksRaw)) {
      links[key] = parseProjectLink(value);
    }

    return {
      version: 2,
      defaultLinkKey: typeof parsed.defaultLinkKey === "string" ? parsed.defaultLinkKey : undefined,
      links
    };
  }

  // Backward compatibility with old single-link config format.
  if (typeof parsed.project === "string" && typeof parsed.environment === "string") {
    const link = parseProjectLink(parsed);
    const key = makeLinkKey(link.project, link.environment);
    return {
      version: 2,
      defaultLinkKey: key,
      links: {
        [key]: link
      }
    };
  }

  throw new Error("Invalid local config format.");
}

export async function loadLocalConfig(cwd = process.cwd()): Promise<LocalConfigFile | null> {
  const configPath = getLocalConfigPath(cwd);
  if (!(await exists(configPath))) {
    return null;
  }

  const raw = await fs.readFile(configPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  return normalizeConfig(parsed);
}

export async function saveLocalConfig(config: LocalConfigFile, cwd = process.cwd()): Promise<void> {
  const configDir = getLocalConfigDir(cwd);
  const configPath = getLocalConfigPath(cwd);
  await ensurePrivateDir(configDir);
  await writePrivateFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

export async function upsertLocalLink(
  link: ProjectLink,
  input: {
    cwd?: string;
    setAsDefault?: boolean;
  } = {}
): Promise<void> {
  const cwd = input.cwd ?? process.cwd();
  const existing = await loadLocalConfig(cwd);
  const config: LocalConfigFile = existing ?? {
    version: 2,
    defaultLinkKey: undefined,
    links: {}
  };

  const key = makeLinkKey(link.project, link.environment);
  config.links[key] = link;
  if (input.setAsDefault ?? true) {
    config.defaultLinkKey = key;
  }

  await saveLocalConfig(config, cwd);
}

export async function listLocalLinks(cwd = process.cwd()): Promise<ProjectLink[]> {
  const config = await loadLocalConfig(cwd);
  if (!config) {
    return [];
  }

  return Object.values(config.links).sort((a, b) => {
    const projectCmp = a.project.localeCompare(b.project);
    if (projectCmp !== 0) {
      return projectCmp;
    }
    return a.environment.localeCompare(b.environment);
  });
}

function resolveFromFilters(
  links: ProjectLink[],
  input: {
    project?: string;
    environment?: string;
  }
): ProjectLink[] {
  return links.filter((link) => {
    if (input.project && link.project !== input.project) {
      return false;
    }
    if (input.environment && link.environment !== input.environment) {
      return false;
    }
    return true;
  });
}

export async function requireLocalConfig(
  input: {
    cwd?: string;
    project?: string;
    environment?: string;
  } = {}
): Promise<ProjectLink> {
  const cwd = input.cwd ?? process.cwd();
  const config = await loadLocalConfig(cwd);
  if (!config) {
    throw new Error("Missing local config. Run `cfenv setup` or `cfenv link` first.");
  }

  const links = Object.values(config.links);
  if (!links.length) {
    throw new Error("No links found in local config. Run `cfenv setup` or `cfenv link` first.");
  }

  const matches = resolveFromFilters(links, {
    project: input.project,
    environment: input.environment
  });

  if (matches.length === 1) {
    return matches[0];
  }
  if (matches.length > 1) {
    if (config.defaultLinkKey) {
      const defaultLink = config.links[config.defaultLinkKey];
      if (defaultLink && matches.some((item) => item.project === defaultLink.project && item.environment === defaultLink.environment)) {
        return defaultLink;
      }
    }
    const options = matches.map((item) => `${item.project}/${item.environment}`).join(", ");
    throw new Error(`Multiple matching links found. Specify --project/--env. Options: ${options}`);
  }

  if (input.project || input.environment) {
    throw new Error(`No link found for project/env filters (${input.project ?? "*"} / ${input.environment ?? "*"}).`);
  }

  if (config.defaultLinkKey) {
    const defaultLink = config.links[config.defaultLinkKey];
    if (defaultLink) {
      return defaultLink;
    }
  }

  if (links.length === 1) {
    return links[0];
  }

  const options = links.map((item) => `${item.project}/${item.environment}`).join(", ");
  throw new Error(`Multiple environments configured. Specify --env (and optionally --project). Options: ${options}`);
}

export async function setDefaultLocalLink(
  input: {
    cwd?: string;
    project?: string;
    environment: string;
  }
): Promise<ProjectLink> {
  const cwd = input.cwd ?? process.cwd();
  const config = await loadLocalConfig(cwd);
  if (!config) {
    throw new Error("Missing local config. Run `cfenv setup` or `cfenv link` first.");
  }

  const links = Object.values(config.links);
  const matches = resolveFromFilters(links, {
    project: input.project,
    environment: input.environment
  });

  if (matches.length !== 1) {
    if (!matches.length) {
      throw new Error(`No link found for environment "${input.environment}".`);
    }
    const options = matches.map((item) => `${item.project}/${item.environment}`).join(", ");
    throw new Error(`Multiple matches for environment. Pass --project. Options: ${options}`);
  }

  const target = matches[0];
  config.defaultLinkKey = makeLinkKey(target.project, target.environment);
  await saveLocalConfig(config, cwd);
  return target;
}
