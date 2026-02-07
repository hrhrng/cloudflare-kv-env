# cfenv (`cfenv-kv-sync`)

Cloudflare KV-backed environment sync CLI with a built-in Node hot-update SDK.

## Install

```bash
npm install -g cfenv-kv-sync
```

## Core Commands

```bash
# one-step setup (uses Wrangler auth by default)
cfenv setup --project myapp --env development

# explicit token setup
cfenv login --profile default --account-id <ACCOUNT_ID> --api-token <API_TOKEN>
cfenv link --project myapp --env development --namespace-id <NAMESPACE_ID> --profile default

# sync
cfenv push --env development --file .env
cfenv pull --env development --out .env --overwrite

# export (CI/runtime)
cfenv export --env production --format dotenv --stdout
cfenv export --env production --format json --stdout
```

## Storage Model

Default `flat` mode:

- `cfenv:<project>:<env>:vars:<ENV_KEY>` => env value
- `cfenv:<project>:<env>:meta` => checksum and update metadata

Optional `snapshot` mode stores versioned snapshots and supports encrypted payloads.

## Node SDK Hot Update

```ts
import { CfenvHotUpdateClient, applyEntriesToProcessEnv } from "cfenv-kv-sync";

const client = new CfenvHotUpdateClient({
  accountId: process.env.CF_ACCOUNT_ID!,
  apiToken: process.env.CF_API_TOKEN!,
  namespaceId: process.env.CF_NAMESPACE_ID!,
  project: "myapp",
  environment: "production",
  intervalMs: 30_000,
  onUpdate(snapshot) {
    applyEntriesToProcessEnv(snapshot.entries, { overwrite: true });
  }
});

await client.start();
```

## Security Notes

- Use dedicated API tokens for CI/runtime.
- Do not commit `.env` files.
- Flat mode stores raw env values in KV.
