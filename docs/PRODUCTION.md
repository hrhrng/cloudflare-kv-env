# Production Checklist

## 1. Identity and Access

- Use dedicated API tokens for CI/runtime, not personal Wrangler OAuth.
- Scope token permissions to required KV access only.
- Rotate tokens regularly and update secrets in CI provider.

## 2. Environment Topology

- Configure separate targets for `development`, `preview`, `production`.
- Keep production writes restricted to release pipeline and admins.

## 3. Pipeline Integration

- Run `cfenv export --env <env> --format dotenv --out .env --overwrite` in CI before build/deploy.
- Never print env values in logs.
- Keep `.env` out of source control.

## 4. Runtime Integration

- Fetch env before service boot and load from a runtime-only file path.
- On pull/export failures, fail fast in CI; in runtime, use explicit fallback policy.
- For dynamic runtime refresh in Node services, use the hot update SDK polling loop.
- For Python services, use `packages/python-sdk/cfenv_sdk` hot updater with backoff and checksum verification.

## 5. Reliability

- Cloudflare API calls include timeout + retry/backoff for transient failures.
- Monitor failed pulls/exports in deployment logs.

## 6. Recovery

- Snapshot mode is recommended when rollback/version history is required.
- Keep change audit metadata (`updatedBy`, `updatedAt`, checksum) and review regularly.
