import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

import type { EncryptedSnapshotEnvelope } from "../types.js";

const ENCRYPTION_FORMAT = "cfenv-aes-256-gcm-v1";
const ENCRYPTION_ALGO = "aes-256-gcm";
const KEY_LENGTH_BYTES = 32;
const SALT_LENGTH_BYTES = 16;
const IV_LENGTH_BYTES = 12;
const DEFAULT_SECRET_BYTES = 32;

function deriveKey(secret: string, salt: Buffer): Buffer {
  return scryptSync(secret, salt, KEY_LENGTH_BYTES);
}

function encode(value: Buffer): string {
  return value.toString("base64");
}

function decode(value: string): Buffer {
  return Buffer.from(value, "base64");
}

export function generateEncryptionSecret(byteLength = DEFAULT_SECRET_BYTES): string {
  if (!Number.isInteger(byteLength) || byteLength < 16 || byteLength > 1024) {
    throw new Error("Encryption secret length must be an integer between 16 and 1024 bytes.");
  }
  return randomBytes(byteLength).toString("base64url");
}

export function encryptSnapshotPayload(plaintext: string, secret: string): string {
  if (!secret.trim()) {
    throw new Error("Missing encryption secret.");
  }

  const salt = randomBytes(SALT_LENGTH_BYTES);
  const iv = randomBytes(IV_LENGTH_BYTES);
  const key = deriveKey(secret, salt);
  const cipher = createCipheriv(ENCRYPTION_ALGO, key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const envelope: EncryptedSnapshotEnvelope = {
    format: ENCRYPTION_FORMAT,
    kdf: "scrypt",
    saltB64: encode(salt),
    ivB64: encode(iv),
    authTagB64: encode(authTag),
    ciphertextB64: encode(ciphertext)
  };

  return JSON.stringify(envelope);
}

function isEncryptedEnvelope(value: unknown): value is EncryptedSnapshotEnvelope {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Partial<EncryptedSnapshotEnvelope>;
  return (
    item.format === ENCRYPTION_FORMAT &&
    item.kdf === "scrypt" &&
    typeof item.saltB64 === "string" &&
    typeof item.ivB64 === "string" &&
    typeof item.authTagB64 === "string" &&
    typeof item.ciphertextB64 === "string"
  );
}

export function decryptSnapshotPayload(payload: string, secret?: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return payload;
  }

  if (!isEncryptedEnvelope(parsed)) {
    return payload;
  }

  if (!secret?.trim()) {
    throw new Error("Snapshot is encrypted. Pass --encryption-key or set CFENV_ENCRYPTION_KEY.");
  }

  const envelope = parsed;
  const salt = decode(envelope.saltB64);
  const iv = decode(envelope.ivB64);
  const authTag = decode(envelope.authTagB64);
  const ciphertext = decode(envelope.ciphertextB64);
  const key = deriveKey(secret, salt);

  try {
    const decipher = createDecipheriv(ENCRYPTION_ALGO, key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString("utf8");
  } catch {
    throw new Error("Failed to decrypt snapshot. Encryption key is missing or incorrect.");
  }
}

export function isEncryptedSnapshotPayload(payload: string): boolean {
  try {
    const parsed = JSON.parse(payload);
    return isEncryptedEnvelope(parsed);
  } catch {
    return false;
  }
}
