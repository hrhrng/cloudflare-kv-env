# Getting Started

## Prerequisites

- Node.js 20+
- Cloudflare account
- Wrangler CLI logged in (`wrangler login`) or Cloudflare API token

## Install

```bash
npm install -g cfenv-kv-sync@beta
```

## Fast path (Wrangler logged in)

```bash
cfenv setup --project myapp --env development
cfenv push --env development --file .env
cfenv pull --env development --out .env --overwrite
```

## Token path

```bash
cfenv login --profile default --account-id <ACCOUNT_ID> --api-token <API_TOKEN>
cfenv link --project myapp --env development --namespace-id <NAMESPACE_ID> --profile default
cfenv push --env development --file .env
```

## Verify targets

```bash
cfenv targets
cfenv use --env development
```

## Recommended first workflow

1. `setup` once per environment (`development`, `preview`, `production`).
2. `push` after local env updates.
3. `pull` on any machine that needs latest env.
4. `export` inside CI/runtime startup.
