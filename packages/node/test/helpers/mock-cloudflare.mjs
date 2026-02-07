import fs from "node:fs";

const storePath = process.env.CFENV_TEST_STORE;
if (!storePath) {
  throw new Error("CFENV_TEST_STORE env var is required for mock Cloudflare test harness.");
}

function readStore() {
  if (!fs.existsSync(storePath)) {
    return {
      namespacesByAccount: {},
      namespaces: {},
      kv: {},
      counters: {
        namespace: 1,
      },
    };
  }

  const raw = fs.readFileSync(storePath, "utf8");
  return JSON.parse(raw);
}

function writeStore(store) {
  fs.writeFileSync(storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function ensureNamespaceRecord(store, accountId, namespaceId) {
  if (!store.namespacesByAccount[accountId]) {
    store.namespacesByAccount[accountId] = [];
  }
  if (!store.kv[namespaceId]) {
    store.kv[namespaceId] = {};
  }
  if (!store.namespaces[namespaceId]) {
    store.namespaces[namespaceId] = { accountId, title: namespaceId };
  }

  const exists = store.namespacesByAccount[accountId].some((item) => item.id === namespaceId);
  if (!exists) {
    store.namespacesByAccount[accountId].push({ id: namespaceId, title: store.namespaces[namespaceId].title });
  }
}

function envelope(result, resultInfo) {
  const payload = {
    success: true,
    errors: [],
    result,
  };
  if (resultInfo) {
    payload.result_info = resultInfo;
  }
  return payload;
}

function errorEnvelope(status, message) {
  return new Response(
    JSON.stringify({
      success: false,
      errors: [{ code: status, message }],
      result: null,
    }),
    {
      status,
      headers: { "content-type": "application/json" },
    }
  );
}

async function handleRequest(urlValue, init = {}) {
  const url = new URL(typeof urlValue === "string" ? urlValue : urlValue.toString());
  const method = (init.method || "GET").toUpperCase();
  const pathname = url.pathname;
  const store = readStore();

  if (pathname === "/client/v4/user/tokens/verify" && method === "GET") {
    return new Response(JSON.stringify(envelope({ id: "token-id", status: "active" })), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  if (pathname === "/client/v4/accounts" && method === "GET") {
    return new Response(JSON.stringify(envelope([{ id: "acc-test" }])), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  const nsCollectionMatch = pathname.match(
    /^\/client\/v4\/accounts\/([^/]+)\/storage\/kv\/namespaces$/
  );
  if (nsCollectionMatch) {
    const accountId = decodeURIComponent(nsCollectionMatch[1]);
    if (!store.namespacesByAccount[accountId]) {
      store.namespacesByAccount[accountId] = [];
    }

    if (method === "GET") {
      const page = Number(url.searchParams.get("page") || "1");
      const perPage = Number(url.searchParams.get("per_page") || "100");
      const all = store.namespacesByAccount[accountId] || [];
      const start = Math.max(0, (page - 1) * perPage);
      const result = all.slice(start, start + perPage);
      const totalPages = Math.max(1, Math.ceil(all.length / perPage));
      return new Response(
        JSON.stringify(envelope(result, {
          page,
          per_page: perPage,
          total_pages: totalPages,
        })),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      );
    }

    if (method === "POST") {
      const rawBody = init.body ? await new Response(init.body).text() : "{}";
      const body = JSON.parse(rawBody || "{}");
      const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "untitled";
      const id = `ns-${String(store.counters.namespace).padStart(4, "0")}`;
      store.counters.namespace += 1;

      store.namespacesByAccount[accountId].push({ id, title });
      store.namespaces[id] = { accountId, title };
      store.kv[id] = {};
      writeStore(store);

      return new Response(JSON.stringify(envelope({ id, title })), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    return errorEnvelope(405, `Unsupported method ${method}`);
  }

  const keysMatch = pathname.match(
    /^\/client\/v4\/accounts\/([^/]+)\/storage\/kv\/namespaces\/([^/]+)\/keys$/
  );
  if (keysMatch && method === "GET") {
    const accountId = decodeURIComponent(keysMatch[1]);
    const namespaceId = decodeURIComponent(keysMatch[2]);
    ensureNamespaceRecord(store, accountId, namespaceId);

    const prefix = url.searchParams.get("prefix") || "";
    const limit = Number(url.searchParams.get("limit") || "1000");
    const allKeys = Object.keys(store.kv[namespaceId] || {})
      .filter((key) => key.startsWith(prefix))
      .sort((a, b) => a.localeCompare(b));

    const cursorRaw = url.searchParams.get("cursor");
    const start = cursorRaw ? Number(cursorRaw) : 0;
    const slice = allKeys.slice(start, start + limit);
    const next = start + limit < allKeys.length ? String(start + limit) : undefined;

    return new Response(
      JSON.stringify(
        envelope(
          slice.map((name) => ({ name })),
          next ? { cursor: next } : undefined
        )
      ),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  }

  const valueMatch = pathname.match(
    /^\/client\/v4\/accounts\/([^/]+)\/storage\/kv\/namespaces\/([^/]+)\/values\/(.+)$/
  );
  if (valueMatch) {
    const accountId = decodeURIComponent(valueMatch[1]);
    const namespaceId = decodeURIComponent(valueMatch[2]);
    const key = decodeURIComponent(valueMatch[3]);
    ensureNamespaceRecord(store, accountId, namespaceId);

    if (method === "PUT") {
      const value = init.body ? await new Response(init.body).text() : "";
      store.kv[namespaceId][key] = value;
      writeStore(store);
      return new Response("", { status: 200 });
    }

    if (method === "GET") {
      const value = store.kv[namespaceId][key];
      if (value === undefined) {
        return new Response("Not found", { status: 404 });
      }
      return new Response(value, {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    if (method === "DELETE") {
      delete store.kv[namespaceId][key];
      writeStore(store);
      return new Response("", { status: 200 });
    }

    return errorEnvelope(405, `Unsupported method ${method}`);
  }

  return errorEnvelope(404, `Unhandled path: ${pathname}`);
}

globalThis.fetch = async (url, init) => handleRequest(url, init);
