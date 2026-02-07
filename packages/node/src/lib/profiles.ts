import { promises as fs } from "node:fs";

import type { CfenvProfile, ProfilesFile } from "../types.js";
import { ensurePrivateDir, exists, writePrivateFile } from "./fs-utils.js";
import { getGlobalConfigDir, getProfilesPath } from "./paths.js";

function parseProfile(raw: unknown, keyHint: string): CfenvProfile {
  if (!raw || typeof raw !== "object") {
    throw new Error(`Invalid profile "${keyHint}".`);
  }
  const record = raw as Record<string, unknown>;

  const name = typeof record.name === "string" && record.name.trim() ? record.name : keyHint;
  const accountId = typeof record.accountId === "string" ? record.accountId : "";
  const createdAt = typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString();
  const updatedAt = typeof record.updatedAt === "string" ? record.updatedAt : createdAt;
  const apiToken = typeof record.apiToken === "string" ? record.apiToken : undefined;
  const authSource = record.authSource === "wrangler" || record.authSource === "api-token"
    ? record.authSource
    : undefined;

  if (!accountId.trim()) {
    throw new Error(`Invalid profile "${keyHint}": missing accountId.`);
  }

  return {
    name,
    accountId,
    apiToken,
    authSource,
    createdAt,
    updatedAt
  };
}

export async function loadProfiles(): Promise<ProfilesFile> {
  const profilesPath = getProfilesPath();
  if (!(await exists(profilesPath))) {
    return {
      version: 1,
      profiles: {},
      defaultProfile: undefined
    };
  }

  const raw = await fs.readFile(profilesPath, "utf8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const rawProfiles = parsed.profiles;
  const profiles: Record<string, CfenvProfile> = {};
  if (rawProfiles && typeof rawProfiles === "object") {
    for (const [key, value] of Object.entries(rawProfiles as Record<string, unknown>)) {
      profiles[key] = parseProfile(value, key);
    }
  }

  return {
    version: 1,
    profiles,
    defaultProfile: typeof parsed.defaultProfile === "string" ? parsed.defaultProfile : undefined
  };
}

export async function saveProfiles(data: ProfilesFile): Promise<void> {
  const configDir = getGlobalConfigDir();
  const profilesPath = getProfilesPath();
  await ensurePrivateDir(configDir);
  await writePrivateFile(profilesPath, `${JSON.stringify(data, null, 2)}\n`);
}

export async function upsertProfile(profile: CfenvProfile, setAsDefault = true): Promise<void> {
  const profiles = await loadProfiles();
  profiles.profiles[profile.name] = profile;
  if (setAsDefault) {
    profiles.defaultProfile = profile.name;
  }
  await saveProfiles(profiles);
}

export async function getProfile(name?: string): Promise<CfenvProfile> {
  const profiles = await loadProfiles();
  const profileName = name ?? profiles.defaultProfile;

  if (!profileName) {
    const allNames = Object.keys(profiles.profiles);
    if (allNames.length === 1) {
      return profiles.profiles[allNames[0]];
    }
    throw new Error("No profile selected. Run `cfenv login` first or pass --profile.");
  }

  const profile = profiles.profiles[profileName];
  if (!profile) {
    throw new Error(`Profile "${profileName}" does not exist. Run \`cfenv login --profile ${profileName}\`.`);
  }

  return profile;
}

export async function listProfileNames(): Promise<string[]> {
  const profiles = await loadProfiles();
  return Object.keys(profiles.profiles).sort((a, b) => a.localeCompare(b));
}
