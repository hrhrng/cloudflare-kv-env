# CI & Runtime

## CI pipeline usage

Use `cfenv export` before build/deploy.

```bash
cfenv export --env production --format dotenv --out .env --overwrite
```

Do not print env values to logs.

## Runtime injection

- Startup: pull/export env to runtime-only file.
- App boot: load env from that file.
- Failure policy: fail fast in CI; explicit fallback in runtime.

## Service account guidance

For CI/prod, prefer dedicated API tokens over personal OAuth sessions.

Minimum token capability:

- KV read/write for target namespace/account
