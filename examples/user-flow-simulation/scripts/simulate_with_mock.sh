#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
APP_DIR="$ROOT_DIR/examples/user-flow-simulation/demo-app"
STORE_PATH="$ROOT_DIR/examples/user-flow-simulation/mock-kv-store.json"
MOCK_HOME="$ROOT_DIR/examples/user-flow-simulation/mock-home"
CLI_ENTRY="$ROOT_DIR/packages/node/src/index.ts"
TSX_LOADER="$ROOT_DIR/node_modules/tsx/dist/loader.mjs"
MOCK_FETCH="$ROOT_DIR/packages/node/test/helpers/mock-cloudflare.mjs"

run_cli() {
  HOME="$MOCK_HOME" \
  XDG_CONFIG_HOME="$MOCK_HOME/.config" \
  CFENV_TEST_STORE="$STORE_PATH" \
  node --import "$TSX_LOADER" --import "$MOCK_FETCH" "$CLI_ENTRY" "$@"
}

rm -rf "$APP_DIR/.cfenv" "$MOCK_HOME" "$STORE_PATH" "$APP_DIR/.env" "$APP_DIR/.env.pulled" "$APP_DIR/exported.json"
cp "$APP_DIR/.env.example" "$APP_DIR/.env"

cd "$APP_DIR"

echo "[1/5] login"
run_cli login --profile default --account-id acc-demo --api-token token-demo

echo "[2/5] link target"
run_cli link --project demo --env development --namespace-id ns-demo --profile default --mode flat

echo "[3/5] push .env to mock KV"
run_cli push --env development --file .env --mode flat

echo "[4/5] pull back into .env.pulled"
run_cli pull --env development --mode flat --out .env.pulled --overwrite

echo "[5/5] export to JSON"
run_cli export --env development --mode flat --format json --out exported.json --overwrite

echo ""
echo "Done. Generated files:"
ls -la .env .env.pulled exported.json
