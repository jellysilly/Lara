#!/data/data/com.termux/files/usr/bin/bash
#
# Sets Lara up on Android under Termux and serves it locally.
#
#   bash scripts/termux.sh            → install, build, serve on localhost:8080
#   bash scripts/termux.sh --lan      → also reachable from your local network
#   bash scripts/termux.sh --serve    → skip install and build, just serve
#
set -euo pipefail

cd "$(dirname "$0")/.."

LAN=0
SERVE_ONLY=0
for argument in "$@"; do
  case "$argument" in
    --lan) LAN=1 ;;
    --serve) SERVE_ONLY=1 ;;
    -h|--help) sed -n '3,8p' "$0"; exit 0 ;;
    *) echo "Unknown option: $argument" >&2; exit 1 ;;
  esac
done

say() { printf '\n\033[36m==>\033[0m %s\n' "$1"; }

if [ "$SERVE_ONLY" -eq 0 ]; then
  if ! command -v node >/dev/null 2>&1; then
    say "Installing Node.js"
    pkg install -y nodejs-lts
  fi

  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
  if [ "$NODE_MAJOR" -lt 20 ]; then
    echo "Node 20 or newer is required (found $(node -v))." >&2
    echo "Try: pkg install nodejs-lts" >&2
    exit 1
  fi

  say "Installing dependencies (this takes a few minutes on a phone)"
  npm install --no-audit --no-fund

  say "Building"
  npm run build
fi

# Keeps Android from suspending the process while you are chatting.
if command -v termux-wake-lock >/dev/null 2>&1; then
  termux-wake-lock
  trap 'termux-wake-unlock >/dev/null 2>&1 || true' EXIT
fi

say "Starting the server"
if [ "$LAN" -eq 1 ]; then
  HOST=0.0.0.0 PORT="${PORT:-8080}" node scripts/serve.mjs
else
  PORT="${PORT:-8080}" node scripts/serve.mjs
fi
