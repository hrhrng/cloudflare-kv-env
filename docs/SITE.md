# Docs Site

This project uses **MkDocs Material** for documentation hosting on GitHub Pages.

## Local preview

```bash
pip install mkdocs-material
mkdocs serve
```

Open local URL shown by MkDocs (typically `http://127.0.0.1:8000`).

## Build

```bash
mkdocs build --clean --strict
```

## Deployment

- Workflow: `.github/workflows/docs-pages.yml`
- Trigger: push to `main` or manual dispatch
- Deploy target: GitHub Pages (`actions/deploy-pages`)
- Output URL: `https://hrhrng.github.io/cloudflare-kv-env/`

## One-time repository setup

In GitHub repository settings:

1. Open `Settings` -> `Pages`
2. In `Build and deployment`, set `Source` to `GitHub Actions`

Without this one-time setup, deploy job fails with:

- `Failed to create deployment ... Ensure GitHub Pages has been enabled`

## Structure

- Config: `mkdocs.yml`
- Content: `site-docs/`
