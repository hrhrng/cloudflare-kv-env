import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { parseEnvFile, serializeEnvFile, writeTextFileAtomic } from "../src/lib/env-file.js";

test("parseEnvFile supports comments, export prefix, and quoted values", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "cfenv-env-parse-"));
  const envPath = path.join(cwd, ".env");
  await writeFile(
    envPath,
    [
      "# comment",
      "export API_URL=\"https://example.com\"",
      "TOKEN='abc123'",
      "PLAIN=value",
      "EMPTY=",
      ""
    ].join("\n"),
    "utf8"
  );

  const parsed = await parseEnvFile(envPath);
  assert.deepEqual(parsed, {
    API_URL: "https://example.com",
    TOKEN: "abc123",
    PLAIN: "value",
    EMPTY: ""
  });
});

test("parseEnvFile rejects invalid keys", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "cfenv-env-invalid-"));
  const envPath = path.join(cwd, ".env");
  await writeFile(envPath, "INVALID-KEY=1\n", "utf8");

  await assert.rejects(() => parseEnvFile(envPath), /Invalid env key/);
});

test("serializeEnvFile sorts keys and emits valid JSON-quoted values", () => {
  const serialized = serializeEnvFile({ B: "2", A: "hello world" });
  assert.equal(serialized, 'A="hello world"\nB="2"\n');
});

test("writeTextFileAtomic writes content", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "cfenv-env-write-"));
  const outPath = path.join(cwd, "out.txt");

  await writeTextFileAtomic(outPath, "hello\n");
  const content = await readFile(outPath, "utf8");
  assert.equal(content, "hello\n");
});
