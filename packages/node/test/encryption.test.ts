import assert from "node:assert/strict";
import test from "node:test";

import { decryptSnapshotPayload, encryptSnapshotPayload } from "../src/lib/encryption.js";

test("encryption roundtrip succeeds with same key", () => {
  const secret = "unit-test-secret";
  const plaintext = JSON.stringify({
    hello: "world",
    nested: {
      ok: true
    }
  });

  const encrypted = encryptSnapshotPayload(plaintext, secret);
  const decrypted = decryptSnapshotPayload(encrypted, secret);

  assert.equal(decrypted, plaintext);
});

test("decrypt throws with wrong key", () => {
  const plaintext = JSON.stringify({ value: "secret" });
  const encrypted = encryptSnapshotPayload(plaintext, "correct-key");

  assert.throws(
    () => decryptSnapshotPayload(encrypted, "wrong-key"),
    /Failed to decrypt snapshot/
  );
});

test("decrypt passes through plaintext payload", () => {
  const payload = JSON.stringify({ schema: 1, ok: true });
  const result = decryptSnapshotPayload(payload, undefined);
  assert.equal(result, payload);
});
