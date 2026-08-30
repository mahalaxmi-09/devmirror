#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

npm ci
npm ci --prefix backend
npm ci --prefix frontend
