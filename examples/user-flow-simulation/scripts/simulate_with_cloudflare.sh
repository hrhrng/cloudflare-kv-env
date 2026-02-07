#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
APP_DIR="$ROOT_DIR/examples/user-flow-simulation/demo-app"
CLI_ENTRY="$ROOT_DIR/packages/node/src/index.ts"
TSX_LOADER="$ROOT_DIR/node_modules/tsx/dist/loader.mjs"

# Required for token mode:
# export CF_ACCOUNT_ID="<your_account_id>"
# export CF_API_TOKEN="<your_api_token_with_kv_read_write>"
# export CF_NAMESPACE_ID="<your_kv_namespace_id>"

run_cli() {
  node --import "$TSX_LOADER" "$CLI_ENTRY" "$@"
}

cd "$APP_DIR"
cp -f .env.example .env

# Option A: one-step setup with explicit token
run_cli setup \
  --project demo \
  --env development \
  --account-id "$CF_ACCOUNT_ID" \
  --api-token "$CF_API_TOKEN" \
  --namespace-id "$CF_NAMESPACE_ID" \
  --no-from-wrangler

# Option B: wrangler auth (replace setup above)
# run_cli setup --project demo --env development

run_cli push --env development --file .env --mode flat
run_cli pull --env development --out .env.pulled --overwrite --mode flat
run_cli export --env development --format dotenv --out .env.runtime --overwrite --mode flat

ls -la .env .env.pulled .env.runtime
