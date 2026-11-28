#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd "$(dirname "$0")" && pwd)"
for gate in build-production-candidate.sh scan-production-candidate.sh deploy-isolated-candidate.sh; do
  output="$(mktemp)"
  if bash "$script_dir/$gate" >"$output" 2>&1; then
    rm -f "$output"
    printf 'FAIL: %s ran without explicit approval\n' "$gate" >&2
    exit 1
  fi
  grep -q '^STOP: ' "$output" || { cat "$output" >&2; rm -f "$output"; exit 1; }
  rm -f "$output"
done
printf 'STOP_GATE_TESTS=3 PASS\n'
