# User Flow Simulation

This folder simulates the full end-user workflow for `cfenv`:

1. Create local `.env`
2. Authenticate (`login` / `setup`)
3. Link project target
4. Push env to KV
5. Pull env from KV
6. Export env for CI/runtime

## Structure

- `demo-app/.env.example`: sample source env file
- `scripts/simulate_with_mock.sh`: full workflow without Cloudflare (uses test mock API)
- `scripts/simulate_with_cloudflare.sh`: full workflow against real Cloudflare KV

## Quick Run (No Cloudflare Required)

From repo root:

```bash
bash examples/user-flow-simulation/scripts/simulate_with_mock.sh
```

Expected outputs in `examples/user-flow-simulation/demo-app`:

- `.env`
- `.env.pulled`
- `exported.json`

## Real Cloudflare Run

Required env vars:

```bash
export CF_ACCOUNT_ID="<account-id>"
export CF_API_TOKEN="<token-with-kv-read-write>"
export CF_NAMESPACE_ID="<kv-namespace-id>"
```

Then run:

```bash
bash examples/user-flow-simulation/scripts/simulate_with_cloudflare.sh
```

Expected outputs in `examples/user-flow-simulation/demo-app`:

- `.env`
- `.env.pulled`
- `.env.runtime`
