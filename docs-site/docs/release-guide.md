# Release Guide

## Required secrets

- `NPM_TOKEN`
- `PYPI_API_TOKEN`

## Publish

Tag push triggers publish workflow:

```bash
git tag v0.1.0-beta.2
git push origin v0.1.0-beta.2
```

Node prerelease goes to npm `beta` dist-tag.
