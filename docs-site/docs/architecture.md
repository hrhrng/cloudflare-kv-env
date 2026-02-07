# Architecture

## Core pieces

- TypeScript CLI
- Cloudflare REST API integration
- KV storage with project+environment scoping

## Data model

### Flat mode

- `cfenv:<project>:<env>:vars:<KEY>`
- `cfenv:<project>:<env>:meta`

### Snapshot mode

- `cfenv:<project>:<env>:current`
- `cfenv:<project>:<env>:versions:<versionId>`

## Constraints

- KV value size limits
- Eventual consistency
- per-key write-rate constraints
