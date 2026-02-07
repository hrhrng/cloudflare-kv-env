# cfenv Monorepo

Multi-language monorepo for `cfenv`:

- Node package (`packages/node`): CLI + Node hot-update SDK (`cfenv-kv-sync`)
- Python package (`packages/python-sdk`): Python SDK (`cfenv-kv-sync-python`)

## Repo Structure

```text
.
├─ packages/
│  ├─ node/
│  │  ├─ src/
│  │  ├─ test/
│  │  ├─ package.json
│  │  └─ tsconfig.json
│  └─ python-sdk/
│     ├─ cfenv_sdk/
│     ├─ tests/
│     ├─ pyproject.toml
│     └─ uv.lock
├─ docs/
├─ examples/
└─ .github/workflows/ci.yml
```

## Development

### Node (CLI + SDK)

```bash
npm install
npm run check
npm run test
npm run build
```

Run CLI locally:

```bash
npm run -w packages/node dev -- --help
```

### Python SDK (uv)

```bash
npm run python:sync
npm run python:test
```

Or directly:

```bash
cd packages/python-sdk
uv sync --frozen
uv run python -m unittest discover -s tests -v
```

## Package READMEs

- Node package docs: `packages/node/README.md`
- Python package docs: `packages/python-sdk/README.md`

## Additional Docs

- Architecture and plan: `docs/PLAN.md`
- Production checklist: `docs/PRODUCTION.md`
- Release guide: `docs/RELEASE.md`
- End-user simulation: `examples/user-flow-simulation/README.md`
- Docs site source: `mkdocs.yml` + `site-docs/`

## Publish via GitHub

Publishing is automated by `/Users/xiaoyang/Proj/cloudflare-kv-env/.github/workflows/publish.yml`.

Required repository secrets:

- `NPM_TOKEN`
- `PYPI_API_TOKEN`

Trigger options:

- Push a release tag such as `v0.1.0-beta.1`
- Or run the workflow manually from GitHub Actions

## Docs Deploy (GitHub Pages)

Docs deploy is automated by `/Users/xiaoyang/Proj/cloudflare-kv-env/.github/workflows/docs-pages.yml` using MkDocs Material.

After first successful run, the site will be available at:

- `https://hrhrng.github.io/cloudflare-kv-env/`

One-time setup required in GitHub:

1. `Settings` -> `Pages`
2. Set `Build and deployment` -> `Source` to `GitHub Actions`
