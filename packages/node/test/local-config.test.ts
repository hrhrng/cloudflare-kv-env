import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  listLocalLinks,
  loadLocalConfig,
  requireLocalConfig,
  setDefaultLocalLink,
  upsertLocalLink
} from "../src/lib/local-config.js";

function makeLink(environment: string) {
  return {
    version: 1 as const,
    profile: "default",
    namespaceId: "ns-id",
    keyPrefix: "cfenv",
    project: "demo",
    environment,
    storageMode: "flat" as const
  };
}

test("local config supports multi-environment selection", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "cfenv-local-config-"));

  await upsertLocalLink(makeLink("development"), { cwd, setAsDefault: true });
  await upsertLocalLink(makeLink("preview"), { cwd, setAsDefault: false });
  await upsertLocalLink(makeLink("production"), { cwd, setAsDefault: false });

  const links = await listLocalLinks(cwd);
  assert.equal(links.length, 3);

  const defaultLink = await requireLocalConfig({ cwd });
  assert.equal(defaultLink.environment, "development");

  const previewLink = await requireLocalConfig({ cwd, environment: "preview" });
  assert.equal(previewLink.environment, "preview");

  const selected = await setDefaultLocalLink({ cwd, environment: "production" });
  assert.equal(selected.environment, "production");

  const nextDefault = await requireLocalConfig({ cwd });
  assert.equal(nextDefault.environment, "production");
});

test("old single-link config migrates to v2 format", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "cfenv-local-config-migrate-"));
  const configDir = path.join(cwd, ".cfenv");
  const configPath = path.join(configDir, "config.json");

  await mkdir(configDir, { recursive: true });
  await writeFile(
    configPath,
    `${JSON.stringify(makeLink("development"), null, 2)}\n`,
    "utf8"
  );

  const migrated = await loadLocalConfig(cwd);
  assert.ok(migrated);
  assert.equal(migrated.version, 2);
  assert.equal(Object.keys(migrated.links).length, 1);
  assert.equal(migrated.defaultLinkKey, "demo:development");

  const link = await requireLocalConfig({ cwd });
  assert.equal(link.environment, "development");
});
