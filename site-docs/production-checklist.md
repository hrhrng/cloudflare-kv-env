# Production Checklist

## Identity & Access

- Use dedicated tokens for CI/runtime.
- Scope permissions minimally.
- Rotate tokens regularly.

## Environment topology

- Configure `development`, `preview`, `production`.
- Restrict production writes to release pipeline/admins.

## Pipeline integration

- Export env before build/deploy.
- Keep `.env` out of source control.
- Never log secret values.

## Runtime

- Load env from runtime-only path.
- Define explicit failure fallback policy.
- Optionally use SDK hot update with checksum verification.

## Reliability & recovery

- Monitor failed pull/export operations.
- Use snapshot mode for rollback-heavy environments.
