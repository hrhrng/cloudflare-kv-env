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

## Structure

- Config: `mkdocs.yml`
- Content: `site-docs/`
