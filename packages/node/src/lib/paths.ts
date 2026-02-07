import os from "node:os";
import path from "node:path";

export function getGlobalConfigDir(): string {
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"), "cfenv");
  }

  const xdgConfig = process.env.XDG_CONFIG_HOME;
  if (xdgConfig) {
    return path.join(xdgConfig, "cfenv");
  }

  return path.join(os.homedir(), ".config", "cfenv");
}

export function getProfilesPath(): string {
  return path.join(getGlobalConfigDir(), "profiles.json");
}

export function getLocalConfigDir(cwd: string): string {
  return path.join(cwd, ".cfenv");
}

export function getLocalConfigPath(cwd: string): string {
  return path.join(getLocalConfigDir(cwd), "config.json");
}
