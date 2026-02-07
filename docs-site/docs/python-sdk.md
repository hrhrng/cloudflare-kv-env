# Python SDK

Install:

```bash
pip install cfenv-kv-sync-python
```

Use:

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

Hot update:

```python
watcher = client.create_hot_updater(
    on_update=lambda snapshot, reason: client.apply_to_process_env(overwrite=True),
    on_error=lambda err: print(err),
    interval_seconds=30,
    max_interval_seconds=300,
    bootstrap=True,
)
watcher.start()
```
