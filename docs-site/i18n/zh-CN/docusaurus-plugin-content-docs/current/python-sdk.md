# Python SDK

安装：

```bash
pip install cfenv-kv-sync-python
```

示例：

```python
from cfenv_sdk import CfenvClient

client = CfenvClient(
    account_id="...",
    api_token="...",
    namespace_id="...",
    project="myapp",
    environment="production",
)

snapshot = client.fetch_flat_env()
print(snapshot.entries)
```
