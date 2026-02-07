# User Flow Simulation

This repo includes end-to-end simulation assets at:

- `examples/user-flow-simulation/README.md`
- `examples/user-flow-simulation/scripts/simulate_with_mock.sh`
- `examples/user-flow-simulation/scripts/simulate_with_cloudflare.sh`

## Mock flow (no Cloudflare)

```bash
bash examples/user-flow-simulation/scripts/simulate_with_mock.sh
```

## Real Cloudflare flow

Set environment variables:

```bash
export CF_ACCOUNT_ID="<account-id>"
export CF_API_TOKEN="<api-token>"
export CF_NAMESPACE_ID="<namespace-id>"
```

Run:

```bash
bash examples/user-flow-simulation/scripts/simulate_with_cloudflare.sh
```

Outputs are generated in:

- `examples/user-flow-simulation/demo-app/.env`
- `examples/user-flow-simulation/demo-app/.env.pulled`
- `examples/user-flow-simulation/demo-app/exported.json` or `.env.runtime`
