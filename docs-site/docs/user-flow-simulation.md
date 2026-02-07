# User Flow Simulation

Available scripts:

- `examples/user-flow-simulation/scripts/simulate_with_mock.sh`
- `examples/user-flow-simulation/scripts/simulate_with_cloudflare.sh`

Mock run:

```bash
bash examples/user-flow-simulation/scripts/simulate_with_mock.sh
```

Real Cloudflare run:

```bash
export CF_ACCOUNT_ID=...
export CF_API_TOKEN=...
export CF_NAMESPACE_ID=...
bash examples/user-flow-simulation/scripts/simulate_with_cloudflare.sh
```
