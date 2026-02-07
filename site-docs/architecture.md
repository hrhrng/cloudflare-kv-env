# Architecture

## Goal

A `vercel pull`-style flow using Cloudflare KV as shared env source.

## Components

- TypeScript CLI (`cfenv`)
- Cloudflare REST API integration
- Cloudflare KV namespace storage
- Local profile storage + repo target mapping

## Data model

For each `project + environment`:

### flat mode

- `cfenv:<project>:<env>:vars:<ENV_KEY>` -> env value
- `cfenv:<project>:<env>:meta` -> checksum/update metadata

### snapshot mode

- `cfenv:<project>:<env>:current` -> current pointer metadata
- `cfenv:<project>:<env>:versions:<versionId>` -> snapshot payload

## Flow

1. Parse local `.env`
2. Compute canonical checksum
3. Push keys and metadata (flat) or version+pointer (snapshot)
4. Pull/export reconstructs env file
5. SDK pollers validate checksums before applying

## Constraints

- KV value size limit (25 MiB)
- Eventual consistency
- key length and write-rate constraints
