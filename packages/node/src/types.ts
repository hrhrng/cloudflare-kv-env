export interface CfenvProfile {
  name: string;
  accountId: string;
  apiToken?: string;
  authSource?: "api-token" | "wrangler";
  createdAt: string;
  updatedAt: string;
}

export interface ProfilesFile {
  version: 1;
  profiles: Record<string, CfenvProfile>;
  defaultProfile?: string;
}

export interface ProjectLink {
  version: 1;
  profile: string;
  namespaceId: string;
  keyPrefix: string;
  project: string;
  environment: string;
  storageMode?: "flat" | "snapshot";
}

export interface LocalConfigFile {
  version: 2;
  defaultLinkKey?: string;
  links: Record<string, ProjectLink>;
}

export interface CurrentPointer {
  schema: 1;
  versionId: string;
  checksum: string;
  updatedAt: string;
  updatedBy?: string;
  entriesCount: number;
  encrypted?: boolean;
}

export interface RemoteSnapshot {
  schema: 1;
  versionId: string;
  project: string;
  environment: string;
  checksum: string;
  updatedAt: string;
  updatedBy?: string;
  entries: Record<string, string>;
}

export interface KvListKeyItem {
  name: string;
  expiration?: number;
  metadata?: unknown;
}

export interface FlatEnvMetadata {
  schema: 1;
  mode: "flat";
  checksum: string;
  updatedAt: string;
  updatedBy?: string;
  entriesCount: number;
}

export interface EncryptedSnapshotEnvelope {
  format: "cfenv-aes-256-gcm-v1";
  kdf: "scrypt";
  saltB64: string;
  ivB64: string;
  authTagB64: string;
  ciphertextB64: string;
}
