# cfenv Python SDK

Python SDK for reading `cfenv` flat-mode environment values from Cloudflare KV and applying hot updates.

## Install

```bash
pip install cfenv-kv-sync-python
```

For local development:

```bash
pip install -e /path/to/cloudflare-kv-env/packages/python-sdk
```

Recommended with `uv`:

```bash
cd /path/to/cloudflare-kv-env/packages/python-sdk
uv sync
uv run python -m unittest discover -s tests -v
```

## Basic Usage

```python
from cfenv_sdk import CfenvClient

client = CfenvClient(
    account_id="...",
    api_token="...",
    namespace_id="...",
    project="playheads",
    environment="production",
)

snapshot = client.fetch_flat_env()
print(snapshot.entries)
```

## Export

```python
dotenv_text = client.export_dotenv()
json_text = client.export_json()
```

## Hot Update

```python
from cfenv_sdk import CfenvClient

client = CfenvClient(
    account_id="...",
    api_token="...",
    namespace_id="...",
    project="playheads",
    environment="production",
)

def on_update(snapshot, reason):
    print("updated", reason, snapshot.metadata.updated_at, snapshot.metadata.entries_count)
    client.apply_to_process_env(overwrite=True)

def on_error(err):
    print("hot update error:", err)

watcher = client.create_hot_updater(
    on_update=on_update,
    on_error=on_error,
    interval_seconds=30,
    max_interval_seconds=300,
    bootstrap=True,
)
watcher.start()
```
