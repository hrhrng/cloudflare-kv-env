# 用户流程模拟

脚本位置：

- `examples/user-flow-simulation/scripts/simulate_with_mock.sh`
- `examples/user-flow-simulation/scripts/simulate_with_cloudflare.sh`

Mock 运行：

```bash
bash examples/user-flow-simulation/scripts/simulate_with_mock.sh
```

真实 Cloudflare 运行：

```bash
export CF_ACCOUNT_ID=...
export CF_API_TOKEN=...
export CF_NAMESPACE_ID=...
bash examples/user-flow-simulation/scripts/simulate_with_cloudflare.sh
```
