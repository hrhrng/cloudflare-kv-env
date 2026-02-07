import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { getProfile, listProfileNames, loadProfiles, upsertProfile } from "../src/lib/profiles.js";

async function withTempConfigHome(fn: (configHome: string) => Promise<void>): Promise<void> {
  const originalXdg = process.env.XDG_CONFIG_HOME;
  const configHome = path.join(os.tmpdir(), `cfenv-profiles-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  process.env.XDG_CONFIG_HOME = configHome;

  try {
    await fn(configHome);
  } finally {
    if (originalXdg === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = originalXdg;
    }
  }
}

test("profiles can be upserted, listed, and loaded by default", async () => {
  await withTempConfigHome(async () => {
    await upsertProfile(
      {
        name: "zeta",
        accountId: "acc-z",
        apiToken: "token-z",
        authSource: "api-token",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      },
      true
    );

    await upsertProfile(
      {
        name: "alpha",
        accountId: "acc-a",
        apiToken: "token-a",
        authSource: "api-token",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      },
      false
    );

    const names = await listProfileNames();
    assert.deepEqual(names, ["alpha", "zeta"]);

    const loadedDefault = await getProfile();
    assert.equal(loadedDefault.name, "zeta");

    const explicit = await getProfile("alpha");
    assert.equal(explicit.accountId, "acc-a");

    const loaded = await loadProfiles();
    assert.equal(loaded.defaultProfile, "zeta");
  });
});

test("getProfile falls back to single profile when no default set", async () => {
  await withTempConfigHome(async () => {
    await upsertProfile(
      {
        name: "solo",
        accountId: "acc-solo",
        apiToken: "token-solo",
        authSource: "api-token",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      },
      false
    );

    const loaded = await getProfile();
    assert.equal(loaded.name, "solo");
  });
});

test("loadProfiles rejects invalid profile payload", async () => {
  await withTempConfigHome(async (configHome) => {
    const cfenvDir = path.join(configHome, "cfenv");
    await mkdir(cfenvDir, { recursive: true });

    await writeFile(
      path.join(cfenvDir, "profiles.json"),
      JSON.stringify(
        {
          version: 1,
          profiles: {
            bad: {
              name: "bad",
              accountId: "",
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z"
            }
          }
        },
        null,
        2
      ),
      "utf8"
    );

    await assert.rejects(() => loadProfiles(), /missing accountId/);
  });
});
