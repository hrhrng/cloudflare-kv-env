# Release Guide

## Prerequisites

- GitHub repository secrets set:
  - `NPM_TOKEN`
  - `PYPI_API_TOKEN`
- Versions updated:
  - Node: `packages/node/package.json`
  - Python: `packages/python-sdk/pyproject.toml`

## Beta Versioning

- Node (npm): `0.1.0-beta.1`
- Python (PyPI): `0.1.0b1`

## Local Validation

```bash
npm install
npm run check
npm run test
npm run build
npm run python:sync
npm run python:test
```

## Publish from GitHub

1. Create and push a tag:

```bash
git tag v0.1.0-beta.1
git push origin v0.1.0-beta.1
```

2. GitHub Actions workflow `Publish` runs and publishes:
- npm package `cfenv-kv-sync`
- PyPI package `cfenv-kv-sync-python`

Notes:
- npm pre-release versions are published with `beta` dist-tag automatically.
- Stable versions are published with `latest` dist-tag.
