import assert from "node:assert/strict";
import test from "node:test";

import { CloudflareApiClient } from "../src/lib/cloudflare-api.js";

function successEnvelope(result: unknown): string {
  return JSON.stringify({
    success: true,
    errors: [],
    result
  });
}

test("Cloudflare API client retries on 429", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = (async () => {
    calls += 1;
    if (calls === 1) {
      return new Response(
        successEnvelope([]),
        {
          status: 429,
          headers: {
            "content-type": "application/json",
            "retry-after": "0"
          }
        }
      );
    }

    return new Response(
      successEnvelope([{ id: "ns-1", title: "demo" }]),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
          "cf-ray": "test"
        }
      }
    );
  }) as typeof fetch;

  try {
    const client = new CloudflareApiClient({
      accountId: "acc-1",
      apiToken: "token-1",
      maxRetries: 2,
      retryBaseDelayMs: 1,
      requestTimeoutMs: 1000
    });

    const namespaces = await client.listNamespaces(10);
    assert.equal(calls, 2);
    assert.equal(namespaces.length, 1);
    assert.equal(namespaces[0].id, "ns-1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Cloudflare API client times out and throws clear error", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    await new Promise((_, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
      });
    });
    return new Response(null, { status: 200 });
  }) as typeof fetch;

  try {
    const client = new CloudflareApiClient({
      accountId: "acc-1",
      apiToken: "token-1",
      maxRetries: 0,
      requestTimeoutMs: 20
    });

    await assert.rejects(
      () => client.listNamespaces(10),
      /timed out/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
