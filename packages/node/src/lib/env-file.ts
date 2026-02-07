import { promises as fs } from "node:fs";
import path from "node:path";

const VALID_ENV_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

function decodeValue(rawValue: string): string {
  const value = rawValue.trim();
  if (value.startsWith("\"") && value.endsWith("\"")) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }
  return value;
}

export async function parseEnvFile(filePath: string): Promise<Record<string, string>> {
  const absolutePath = path.resolve(filePath);
  const raw = await fs.readFile(absolutePath, "utf8");
  const entries: Record<string, string> = {};

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const exportPrefix = trimmed.startsWith("export ") ? "export ".length : 0;
    const content = trimmed.slice(exportPrefix);
    const separator = content.indexOf("=");
    if (separator <= 0) {
      continue;
    }

    const key = content.slice(0, separator).trim();
    if (!VALID_ENV_KEY.test(key)) {
      throw new Error(`Invalid env key "${key}" in ${absolutePath}.`);
    }

    const value = decodeValue(content.slice(separator + 1));
    entries[key] = value;
  }

  return entries;
}

export function serializeEnvFile(entries: Record<string, string>): string {
  const lines = Object.keys(entries)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => `${key}=${JSON.stringify(entries[key])}`);
  return `${lines.join("\n")}\n`;
}

export async function writeTextFileAtomic(filePath: string, content: string): Promise<void> {
  const absolutePath = path.resolve(filePath);
  const tmpPath = `${absolutePath}.cfenv.tmp-${process.pid}-${Date.now()}`;

  await fs.writeFile(tmpPath, content, "utf8");
  if (process.platform !== "win32") {
    await fs.chmod(tmpPath, 0o600).catch(() => undefined);
  }
  await fs.rename(tmpPath, absolutePath);
}

export async function writeEnvFileAtomic(filePath: string, content: string): Promise<void> {
  await writeTextFileAtomic(filePath, content);
}
