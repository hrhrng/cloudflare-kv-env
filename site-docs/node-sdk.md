# Node SDK

The npm package exports a hot-update client for runtime env refresh.

## Install

```bash
npm install cfenv-kv-sync@beta
```

## Usage

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
    console.log("updated", snapshot.updatedAt, snapshot.entriesCount);
  },
  onError(error) {
    console.error(error.message);
  }
});

await client.start();
```

## Behavior

- Polls `flat` mode metadata and keys.
- Verifies checksum before applying env entries.
- Uses retry/backoff behavior through API layer.
