# cfenv Architecture and Build Plan

## Goal

Build a `vercel pull`-style CLI (`cfenv`) to sync environment variables across personal computers using Cloudflare KV as the remote store.

## Architecture

### 1. Components

- Local CLI (`cfenv`) written in TypeScript.
- Cloudflare API token auth (Bearer token).
- Cloudflare KV namespace for storage.

### 2. Storage Model

For each `project + environment`:

Default (`flat` mode):
- `cfenv:<project>:<env>:vars:<ENV_KEY>`  
  Stores env var value directly.
- `cfenv:<project>:<env>:meta`  
  Stores checksum/update metadata.

Optional (`snapshot` mode):
- `cfenv:<project>:<env>:current`  
  Stores pointer metadata for latest version.
- `cfenv:<project>:<env>:versions:<versionId>`  
  Stores encrypted env snapshot payload (AES-256-GCM envelope).

### 3. Pull/Push Flow

- `push`
  - Parse local `.env`.
  - Build canonical checksum.
  - Flat mode: write per-var KV keys and update `meta`.
  - Snapshot mode: encrypt payload, write `versions:<versionId>`, then update `current`.
- `pull`
  - Flat mode: list `vars:` keys and rebuild local `.env`.
  - Snapshot mode: read `current`, fetch version, decrypt locally.
  - Write local `.env` atomically.

### 4. Auth and Profile

- User runs `cfenv login` with:
  - `--account-id`
  - API token (arg or `CLOUDFLARE_API_TOKEN`)
- Optional Wrangler-backed profile:
  - `cfenv login --from-wrangler`
  - `cfenv` fetches fresh token from Wrangler on each command.
- CLI stores profile at `~/.config/cfenv/profiles.json`.
- Local project links live at `.cfenv/config.json` (multiple environments supported per repo).

## MVP Scope (Implemented in this repo)

- `cfenv keygen`
- `cfenv setup` (one-step setup)
- `cfenv login`
- `cfenv profiles`
- `cfenv export` (CI/runtime friendly)
- `cfenv link`
- `cfenv push`
- `cfenv pull`
- `cfenv history`
- `cfenv targets`
- `cfenv use`

## API Choices

Use Cloudflare REST API directly (official API):

- `GET /user/tokens/verify`
- `PUT /accounts/{account}/storage/kv/namespaces/{ns}/values/{key}`
- `GET /accounts/{account}/storage/kv/namespaces/{ns}/values/{key}`
- `GET /accounts/{account}/storage/kv/namespaces/{ns}/keys?prefix=...`

## Constraints to Respect

- KV value size <= 25 MiB.
- KV is eventually consistent.
- Key length <= 512 bytes.
- Same-key writes are rate-limited (1 write/sec per key).

## Next Phases

### Phase 1: Hardening

- Better `.env` parser compatibility.
- Optional diff before pull/write.
- Token-at-rest keychain integration for API token and encryption key.

### Phase 2: Security

- Move encryption key storage from environment variables to OS keychain.
- Add key rotation support.
- Add explicit re-encrypt/migrate command across versions.

### Phase 3: Team Features

- Workspace/project auto-detection.
- Structured audit metadata.
- Optional access gateway with Cloudflare Access.
