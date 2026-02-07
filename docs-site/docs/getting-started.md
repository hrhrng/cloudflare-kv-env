# Getting Started

## Install

```bash
npm install -g cfenv-kv-sync@beta
```

## Quick path (Wrangler login reused)

```bash
cfenv setup --project myapp --env development
cfenv push --env development --file .env
cfenv pull --env development --out .env --overwrite
```

## Token path

```bash
cfenv login --profile default --account-id <ACCOUNT_ID> --api-token <API_TOKEN>
cfenv link --project myapp --env development --namespace-id <NAMESPACE_ID>
cfenv push --env development --file .env
```

## Recommended first setup

1. Configure `development`, `preview`, `production`.
2. Use `cfenv targets` and `cfenv use` for default switching.
3. Use `cfenv export` inside CI/runtime startup.
