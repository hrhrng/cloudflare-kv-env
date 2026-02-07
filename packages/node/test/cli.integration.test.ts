import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);

async function runCli(input: {
  args: string[];
  cwd: string;
  homeDir: string;
  storePath: string;
}): Promise<{ stdout: string; stderr: string; code: number }> {
  const srcIndex = path.resolve("src/index.ts");
  const localTsxLoader = path.resolve("node_modules/tsx/dist/loader.mjs");
  const hoistedTsxLoader = path.resolve("../../node_modules/tsx/dist/loader.mjs");
  const tsxLoader = existsSync(localTsxLoader) ? localTsxLoader : hoistedTsxLoader;
  const mockCloudflare = path.resolve("test/helpers/mock-cloudflare.mjs");

  try {
    const result = await execFileAsync(
      process.execPath,
      ["--import", tsxLoader, "--import", mockCloudflare, srcIndex, ...input.args],
      {
        cwd: input.cwd,
        env: {
          ...process.env,
          HOME: input.homeDir,
          XDG_CONFIG_HOME: path.join(input.homeDir, ".config"),
          CFENV_TEST_STORE: input.storePath
        }
      }
    );

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      code: 0
    };
  } catch (error) {
    const item = error as Error & {
      stdout?: string;
      stderr?: string;
      code?: number;
    };
    return {
      stdout: item.stdout ?? "",
      stderr: item.stderr ?? "",
      code: typeof item.code === "number" ? item.code : 1
    };
  }
}

test("CLI integration: login/link/push/pull round-trip works in flat mode", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "cfenv-cli-integration-"));
  const projectDir = path.join(root, "project");
  const homeDir = path.join(root, "home");
  const storePath = path.join(root, "store.json");

  await mkdir(projectDir, { recursive: true });
  await mkdir(homeDir, { recursive: true });
  await writeFile(path.join(projectDir, ".env"), 'API_URL="https://example.com"\nTOKEN="abc123"\n', "utf8");

  const login = await runCli({
    args: ["login", "--profile", "default", "--account-id", "acc-1", "--api-token", "token-1"],
    cwd: projectDir,
    homeDir,
    storePath
  });
  assert.equal(login.code, 0, login.stderr || login.stdout);

  const link = await runCli({
    args: [
      "link",
      "--project",
      "demo",
      "--env",
      "development",
      "--namespace-id",
      "ns-demo",
      "--profile",
      "default",
      "--mode",
      "flat"
    ],
    cwd: projectDir,
    homeDir,
    storePath
  });
  assert.equal(link.code, 0, link.stderr || link.stdout);

  const push = await runCli({
    args: ["push", "--file", ".env", "--mode", "flat"],
    cwd: projectDir,
    homeDir,
    storePath
  });
  assert.equal(push.code, 0, push.stderr || push.stdout);
  assert.match(push.stdout, /Pushed 2 keys/);

  const outFile = path.join(projectDir, ".env.pulled");
  const pull = await runCli({
    args: ["pull", "--mode", "flat", "--out", outFile],
    cwd: projectDir,
    homeDir,
    storePath
  });
  assert.equal(pull.code, 0, pull.stderr || pull.stdout);

  const pulledEnv = await readFile(outFile, "utf8");
  assert.equal(
    pulledEnv,
    'API_URL="https://example.com"\nTOKEN="abc123"\n'
  );
});

test("CLI integration: export supports json and dotenv output", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "cfenv-cli-export-"));
  const projectDir = path.join(root, "project");
  const homeDir = path.join(root, "home");
  const storePath = path.join(root, "store.json");

  await mkdir(projectDir, { recursive: true });
  await mkdir(homeDir, { recursive: true });
  await writeFile(path.join(projectDir, ".env"), 'A="1"\nB="2"\n', "utf8");

  const commands: string[][] = [
    ["login", "--profile", "default", "--account-id", "acc-1", "--api-token", "token-1"],
    ["link", "--project", "demo", "--env", "development", "--namespace-id", "ns-demo", "--profile", "default", "--mode", "flat"],
    ["push", "--file", ".env", "--mode", "flat"]
  ];

  for (const args of commands) {
    const result = await runCli({ args, cwd: projectDir, homeDir, storePath });
    assert.equal(result.code, 0, result.stderr || result.stdout);
  }

  const dotenvExport = await runCli({
    args: ["export", "--mode", "flat", "--format", "dotenv"],
    cwd: projectDir,
    homeDir,
    storePath
  });
  assert.equal(dotenvExport.code, 0, dotenvExport.stderr || dotenvExport.stdout);
  assert.equal(dotenvExport.stdout, 'A="1"\nB="2"\n');

  const jsonExport = await runCli({
    args: ["export", "--mode", "flat", "--format", "json"],
    cwd: projectDir,
    homeDir,
    storePath
  });
  assert.equal(jsonExport.code, 0, jsonExport.stderr || jsonExport.stdout);
  const parsed = JSON.parse(jsonExport.stdout) as Record<string, string>;
  assert.deepEqual(parsed, { A: "1", B: "2" });
});
