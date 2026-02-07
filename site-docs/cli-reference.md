# CLI Reference

## Core Commands

- `cfenv setup`: one-step profile + namespace + local link
- `cfenv login`: store a Cloudflare profile
- `cfenv profiles`: list profiles
- `cfenv link`: link current repo to namespace/project/env
- `cfenv targets`: list local linked targets
- `cfenv use`: switch default target
- `cfenv push`: push local `.env` to KV
- `cfenv pull`: pull env from KV to local file
- `cfenv export`: export env to dotenv/json for CI/runtime
- `cfenv history`: list versions/metadata
- `cfenv keygen`: generate encryption key

## Important Flags

- `--project <name>`: project name
- `--env <name>`: environment name
- `--mode flat|snapshot`: storage mode
- `--profile <name>`: profile override
- `--file <path>`: source env file for push
- `--out <path>`: output path for pull/export
- `--overwrite`: overwrite output file

## Storage modes

### flat (default)

- KV key per environment variable
- easiest to inspect and debug

### snapshot

- stores versioned snapshots
- supports encrypted snapshot payload
- useful for rollback/history-heavy workflows

## Examples

```bash
cfenv setup --project myapp --env production
cfenv push --env production --file .env --mode flat
cfenv export --env production --format dotenv --out .env.runtime --overwrite
```
