# Multi-Environment

`cfenv` supports multiple environments per repository.

## Setup pattern

```bash
cfenv setup --project myapp --env development
cfenv setup --project myapp --env preview
cfenv setup --project myapp --env production
```

## Select target

```bash
cfenv targets
cfenv use --env production
```

## Override at command level

```bash
cfenv pull --env preview --out .env.preview --overwrite
cfenv export --env production --format json --stdout
```

## Recommended topology

- `development`: local and personal testing
- `preview`: branch/staging environments
- `production`: deployment environment

Keep write access to production controlled (release pipeline + admin users).
