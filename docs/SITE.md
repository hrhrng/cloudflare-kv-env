# Docs Site

This project uses **Docusaurus** for documentation hosting on GitHub Pages.

## Local preview

```bash
npm --prefix docs-site install
npm --prefix docs-site run start
```

## Build

```bash
npm --prefix docs-site run build
```

## Deployment

- Workflow: `.github/workflows/docs-pages.yml`
- Trigger: push to `main` or manual dispatch
- Deploy target: GitHub Pages (`actions/deploy-pages`)
- Site home: `https://hrhrng.github.io/cloudflare-kv-env/`
- Docs root: `https://hrhrng.github.io/cloudflare-kv-env/docs/`
- Chinese home: `https://hrhrng.github.io/cloudflare-kv-env/zh-CN/`

## One-time repository setup

In GitHub repository settings:

1. Open `Settings` -> `Pages`
2. In `Build and deployment`, set `Source` to `GitHub Actions`

## Structure

- Site project: `docs-site/`
- Main docs (EN): `docs-site/docs/`
- Chinese docs: `docs-site/i18n/zh-CN/docusaurus-plugin-content-docs/current/`
