import assert from "node:assert/strict";
import test from "node:test";

import { checksumEntries } from "../src/lib/hash.js";
import {
  applyEntriesToProcessEnv,
  CfenvHotUpdateClient
} from "../src/sdk/hot-update.js";

interface FakeStore {
  values: Record<string, string>;
}

function makeClient(store: FakeStore) {
  return {
    async getValue(_namespaceId: string, key: string): Promise<string | null> {
      return store.values[key] ?? null;
    },
    async listKeys(_namespaceId: string, prefix: string): Promise<Array<{ name: string }>> {
      return Object.keys(store.values)
        .filter((key) => key.startsWith(prefix))
        .map((name) => ({ name }));
    }
  };
}

function setFlatPayload(store: FakeStore, input: {
  keyPrefix: string;
  project: string;
  env: string;
  entries: Record<string, string>;
}) {
  const base = `${input.keyPrefix}:${input.project}:${input.env}`;
  const checksum = checksumEntries(input.entries);

  store.values[`${base}:meta`] = JSON.stringify({
    schema: 1,
    mode: "flat",
    checksum,
    updatedAt: new Date().toISOString(),
    updatedBy: "test",
    entriesCount: Object.keys(input.entries).length
  });

  for (const [key, value] of Object.entries(input.entries)) {
    store.values[`${base}:vars:${key}`] = value;
  }
}

test("hot update client refresh detects change only once per checksum", async () => {
  const store: FakeStore = { values: {} };
  setFlatPayload(store, {
    keyPrefix: "cfenv",
    project: "demo",
    env: "development",
    entries: { A: "1", B: "2" }
  });

  const updates: Array<Record<string, string>> = [];
  const client = new CfenvHotUpdateClient({
    accountId: "acc",
    apiToken: "token",
    namespaceId: "ns",
    project: "demo",
    environment: "development",
    keyPrefix: "cfenv",
    bootstrap: false,
    client: makeClient(store),
    onUpdate(snapshot) {
      updates.push(snapshot.entries);
    }
  });

  const first = await client.refreshOnce("initial");
  const second = await client.refreshOnce("changed");

  assert.equal(first, true);
  assert.equal(second, false);
  assert.equal(updates.length, 1);

  setFlatPayload(store, {
    keyPrefix: "cfenv",
    project: "demo",
    env: "development",
    entries: { A: "3", B: "2" }
  });

  const third = await client.refreshOnce("changed");
  assert.equal(third, true);
  assert.equal(updates.length, 2);
  assert.equal(updates[1].A, "3");
});

test("applyEntriesToProcessEnv respects overwrite flag", () => {
  const original = process.env.CFENV_TEST_VAR;
  process.env.CFENV_TEST_VAR = "old";

  try {
    applyEntriesToProcessEnv({ CFENV_TEST_VAR: "new" }, { overwrite: false });
    assert.equal(process.env.CFENV_TEST_VAR, "old");

    applyEntriesToProcessEnv({ CFENV_TEST_VAR: "new" }, { overwrite: true });
    assert.equal(process.env.CFENV_TEST_VAR, "new");
  } finally {
    if (original === undefined) {
      delete process.env.CFENV_TEST_VAR;
    } else {
      process.env.CFENV_TEST_VAR = original;
    }
  }
});
