# Node SDK

```ts
import { CfenvHotUpdateClient, applyEntriesToProcessEnv } from "cfenv-kv-sync";

const client = new CfenvHotUpdateClient({
  accountId: process.env.CF_ACCOUNT_ID!,
  apiToken: process.env.CF_API_TOKEN!,
  namespaceId: process.env.CF_NAMESPACE_ID!,
  project: "myapp",
  environment: "production",
  intervalMs: 30000,
  onUpdate(snapshot) {
    applyEntriesToProcessEnv(snapshot.entries, { overwrite: true });
  }
});

await client.start();
```
