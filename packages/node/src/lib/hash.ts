import { createHash, randomUUID } from "node:crypto";

export function canonicalizeEntries(entries: Record<string, string>): string {
  return Object.keys(entries)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => `${key}=${JSON.stringify(entries[key])}`)
    .join("\n");
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function checksumEntries(entries: Record<string, string>): string {
  return sha256(canonicalizeEntries(entries));
}

export function makeVersionId(now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:.TZ]/g, "");
  return `${stamp}-${randomUUID().slice(0, 8)}`;
}
