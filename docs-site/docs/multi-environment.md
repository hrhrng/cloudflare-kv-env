# Multi-Environment

`cfenv` supports many targets in a single repository.

```bash
cfenv setup --project myapp --env development
cfenv setup --project myapp --env preview
cfenv setup --project myapp --env production
```

```bash
cfenv targets
cfenv use --env production
```

```bash
cfenv pull --env preview --out .env.preview --overwrite
cfenv export --env production --format json --stdout
```
