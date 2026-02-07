# cfenv

[![CI](https://github.com/hrhrng/cloudflare-kv-env/actions/workflows/ci.yml/badge.svg)](https://github.com/hrhrng/cloudflare-kv-env/actions/workflows/ci.yml)
[![Docs Pages](https://github.com/hrhrng/cloudflare-kv-env/actions/workflows/docs-pages.yml/badge.svg)](https://github.com/hrhrng/cloudflare-kv-env/actions/workflows/docs-pages.yml)
[![npm version](https://img.shields.io/npm/v/cfenv-kv-sync?label=npm)](https://www.npmjs.com/package/cfenv-kv-sync)
[![PyPI version](https://img.shields.io/pypi/v/cfenv-kv-sync-python?label=PyPI)](https://pypi.org/project/cfenv-kv-sync-python/)

Portable multi-environment `.env` management on Cloudflare KV.

`cfenv` gives you a Vercel-like flow (`setup/push/pull/export`) while keeping full control of your own Cloudflare account, namespace, and key format.

## Documentation

- Docs (English): [https://hrhrng.github.io/cloudflare-kv-env/docs/](https://hrhrng.github.io/cloudflare-kv-env/docs/)
- 文档（中文）: [https://hrhrng.github.io/cloudflare-kv-env/zh-CN/docs/](https://hrhrng.github.io/cloudflare-kv-env/zh-CN/docs/)
- Project home: [https://hrhrng.github.io/cloudflare-kv-env/](https://hrhrng.github.io/cloudflare-kv-env/)

## Packages

- npm CLI + Node SDK: [`cfenv-kv-sync`](https://www.npmjs.com/package/cfenv-kv-sync)
- Python SDK: [`cfenv-kv-sync-python`](https://pypi.org/project/cfenv-kv-sync-python/)

## Key Features

- One-step setup using Wrangler auth session (`wrangler login`)
- Multi-environment workflow in one repo (`development`, `staging`, `production`, ...)
- CLI sync operations: `setup`, `push`, `pull`, `export`
- Node and Python SDKs for runtime fetch + hot update
- Two storage modes:
  - `flat` (default): one KV key per env var + one metadata key
  - `snapshot`: versioned payload (optional encryption)

## Quick Start (CLI)

### 1. Prerequisites

- Node.js `>=20`
- Cloudflare Wrangler installed and logged in

```bash
npm i -g wrangler
wrangler login
```

### 2. Install

```bash
npm i -g cfenv-kv-sync@beta
```

### 3. One-step setup (reuse Wrangler auth)

```bash
cfenv setup --project playheads --env development
```

This command will:

- read account and OAuth token from Wrangler
- create or reuse KV namespace `cfenv-playheads`
- create local link file at `.cfenv/config.json`

### 4. Sync `.env` to/from KV

```bash
# push local file to KV
cfenv push --env development --file .env.local

# pull from KV to local .env
cfenv pull --env development --out .env --overwrite
```

### 5. Multi-environment usage

```bash
# add another target
cfenv setup --project playheads --env production

# list targets
cfenv targets

# switch default target
cfenv use --env production
```

## Common Commands

```bash
# auth/profile
cfenv login --from-wrangler --profile default
cfenv profiles

# link existing namespace manually
cfenv link --project playheads --env staging --namespace-id <KV_NAMESPACE_ID>

# export env to stdout (for CI/runtime)
cfenv export --env production --format dotenv --stdout
cfenv export --env production --format json --stdout

# generate encryption key for snapshot mode
cfenv keygen --raw
```

## Runtime Integration

### Node SDK

```ts
import { CfenvHotUpdateClient, applyEntriesToProcessEnv } from "cfenv-kv-sync";

const client = new CfenvHotUpdateClient({
  accountId: process.env.CF_ACCOUNT_ID!,
  apiToken: process.env.CF_API_TOKEN!,
  namespaceId: process.env.CF_NAMESPACE_ID!,
  project: "playheads",
  environment: "production",
  intervalMs: 30_000,
  onUpdate(snapshot) {
    applyEntriesToProcessEnv(snapshot.entries, { overwrite: true });
  }
});

await client.start();
```

### Python SDK

```python
from cfenv_sdk import CfenvClient

client = CfenvClient(
    account_id="...",
    api_token="...",
    namespace_id="...",
    project="playheads",
    environment="production",
)

snapshot = client.fetch_flat_env()
client.apply_to_process_env(overwrite=True)
```

## Monorepo Structure

```text
.
├─ packages/
│  ├─ node/         # CLI + Node SDK (npm: cfenv-kv-sync)
│  └─ python-sdk/   # Python SDK (PyPI: cfenv-kv-sync-python)
├─ docs-site/       # Docusaurus docs (EN + zh-CN)
├─ docs/            # internal plans/checklists
└─ examples/        # end-to-end simulation and usage examples
```

## Development

```bash
npm install
npm run check
npm run test
npm run build
npm run python:test
npm run docs:build
```

## Release & Deployment

- Publish workflow: `.github/workflows/publish.yml`
  - required secrets: `NPM_TOKEN`, `PYPI_API_TOKEN`
- Docs Pages workflow: `.github/workflows/docs-pages.yml`
- CI workflow: `.github/workflows/ci.yml`

## Security Notes

- Do not commit `.env` files.
- Use least-privilege Cloudflare tokens in CI/runtime.
- Snapshot encryption is available via `CFENV_ENCRYPTION_KEY`.
