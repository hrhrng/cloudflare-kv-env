# CLI Reference

## Commands

- `cfenv setup`
- `cfenv login`
- `cfenv profiles`
- `cfenv link`
- `cfenv targets`
- `cfenv use`
- `cfenv push`
- `cfenv pull`
- `cfenv export`
- `cfenv history`
- `cfenv keygen`

## Storage modes

### `flat` (default)

- Key per env var
- Best for simplicity and debugging

### `snapshot`

- Versioned snapshots
- Optional encrypted payload

## Example

```bash
cfenv setup --project myapp --env production
cfenv push --env production --file .env --mode flat
cfenv export --env production --format dotenv --out .env.runtime --overwrite
```
