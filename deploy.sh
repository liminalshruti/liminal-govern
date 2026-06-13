#!/usr/bin/env bash
#
# deploy.sh — one-command deploy for the Liminal Govern cockpit (lane G → Vercel)
# ------------------------------------------------------------------------------
# The cockpit is a static Vite + React + TypeScript SPA living in `app/`.
# This script verifies a clean production build locally, then ships `app/` to
# Vercel as a production deployment. The deploy config (build command, output
# directory `dist`, and SPA rewrites to `index.html`) lives in `app/vercel.json`.
#
# Prerequisites:
#   - Node 18+ and npm
#   - A Vercel account. The Vercel CLI is invoked via `npx` (no global install).
#     On first run, `vercel` will prompt you to log in / link the project.
#     For CI/non-interactive use, export a token:  export VERCEL_TOKEN=...
#       (then this script passes --token automatically)
#
# Usage:
#   ./deploy.sh             # verify build + deploy to production
#   ./deploy.sh --preview   # verify build + deploy a preview (non-prod) URL
#   ./deploy.sh --build-only# just run the local production build, no deploy
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$ROOT_DIR/app"

MODE="prod"
for arg in "$@"; do
  case "$arg" in
    --preview)    MODE="preview" ;;
    --build-only) MODE="build-only" ;;
    -h|--help)
      awk 'NR>1 && /^#/ {sub(/^# ?/,""); print; next} NR>1 {exit}' "${BASH_SOURCE[0]}"
      exit 0 ;;
    *) echo "unknown arg: $arg (try --preview, --build-only, --help)"; exit 2 ;;
  esac
done

echo "==> [1/2] Verifying a clean production build in app/"
cd "$APP_DIR"
npm install
npm run build   # tsc -b && vite build  →  app/dist/
echo "    OK: static bundle in $APP_DIR/dist"

if [ "$MODE" = "build-only" ]; then
  echo "==> build-only: skipping deploy. Done."
  exit 0
fi

# Pass --token automatically if a VERCEL_TOKEN is present in the environment.
TOKEN_ARG=()
if [ -n "${VERCEL_TOKEN:-}" ]; then
  TOKEN_ARG=(--token "$VERCEL_TOKEN")
fi

PROD_ARG=()
if [ "$MODE" = "prod" ]; then
  PROD_ARG=(--prod)
  echo "==> [2/2] Deploying app/ to Vercel (PRODUCTION)"
else
  echo "==> [2/2] Deploying app/ to Vercel (preview)"
fi

# Deploy the app/ directory; Vercel reads app/vercel.json for build settings.
npx --yes vercel deploy "${PROD_ARG[@]}" "${TOKEN_ARG[@]}" "$APP_DIR"

echo "==> Deploy complete. Vercel printed the live URL above."
