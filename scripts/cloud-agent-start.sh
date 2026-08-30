#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f backend/.env ]]; then
  cp .env.example backend/.env
  if ! grep -q '^JWT_SECRET=' backend/.env || grep -q '^JWT_SECRET=$' backend/.env; then
    echo "JWT_SECRET=super_secret_devmirror_token_key_123" >> backend/.env
  fi
fi

mkdir -p backend/uploads backend/workspaces
