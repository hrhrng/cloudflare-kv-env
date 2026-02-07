import { promises as fs } from "node:fs";

export async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function ensurePrivateDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
  if (process.platform !== "win32") {
    await fs.chmod(dirPath, 0o700).catch(() => undefined);
  }
}

export async function writePrivateFile(filePath: string, content: string): Promise<void> {
  await fs.writeFile(filePath, content, { encoding: "utf8" });
  if (process.platform !== "win32") {
    await fs.chmod(filePath, 0o600).catch(() => undefined);
  }
}
