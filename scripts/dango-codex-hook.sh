#!/usr/bin/env bash
set -euo pipefail

EVENT="${1:-stop}"

curl -s \
  "http://127.0.0.1:8787/hook?event=${EVENT}&source=codex" \
  >/dev/null 2>&1 || true
