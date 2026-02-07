# Release Guide

## Prerequisites

Repository secrets:

- `NPM_TOKEN`
- `PYPI_API_TOKEN`

## Versioning

- Node beta: `0.1.0-beta.N`
- Python beta: `0.1.0bN`

## Validate locally

```bash
npm install
npm run check
npm run test
npm run build
npm run python:sync
npm run python:test
```

## Publish

Publishing is automated via GitHub Actions `Publish` workflow.

Tag and push:

```bash
git tag v0.1.0-beta.2
git push origin v0.1.0-beta.2
```

The workflow publishes:

- `cfenv-kv-sync` to npm
- `cfenv-kv-sync-python` to PyPI
