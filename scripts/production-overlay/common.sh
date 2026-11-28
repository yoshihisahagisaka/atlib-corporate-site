#!/usr/bin/env bash
set -euo pipefail

overlay_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$overlay_dir/../.." && pwd)"
manifest="$overlay_dir/manifest.json"
project="${PROJECT:-atlib-corporate-site}"
region="${REGION:-asia-northeast1}"
service="${SERVICE:-corporate-site}"

stop() { printf 'STOP: %s\n' "$*" >&2; exit 1; }
require_commands() {
  local command
  for command in "$@"; do command -v "$command" >/dev/null 2>&1 || stop "required command missing: $command"; done
}
manifest_value() { jq -er "$1" "$manifest"; }

assert_clean_approved_content() {
  [[ -z "$(git -C "$repo_root" status --porcelain)" ]] || stop 'worktree is not clean'
  local approved relative expected actual
  approved="$(manifest_value '.headCommit')"
  while IFS= read -r relative; do
    expected="$(git -C "$repo_root" rev-parse "$approved:$relative")" || stop "approved content missing: $relative"
    actual="$(git -C "$repo_root" hash-object "$repo_root/$relative")" || stop "cannot hash current content: $relative"
    [[ "$actual" == "$expected" ]] || stop "current content differs from approved HEAD: $relative"
  done < <(jq -er '.allowedFiles[]' "$manifest")
}

read_production_state() {
  local output="$1" revision_output="$2" expected_revision expected_image
  gcloud run services describe "$service" --project="$project" --region="$region" --format=json >"$output" || stop 'Cloud Run service read-back failed'
  expected_revision="$(manifest_value '.productionRevision')"
  expected_image="$(manifest_value '.baseImage')"
  [[ "$(jq '[.status.traffic[] | select(.percent == 100)] | length' "$output")" == 1 ]] || stop 'Production must have exactly one 100% traffic target'
  [[ "$(jq -r '.status.traffic[] | select(.percent == 100) | .revisionName' "$output")" == "$expected_revision" ]] || stop 'Production revision/traffic mismatch'
  gcloud run revisions describe "$expected_revision" --project="$project" --region="$region" --format=json >"$revision_output" || stop 'Production revision read-back failed'
  [[ "$(jq -r '.status.imageDigest' "$revision_output")" == "$expected_image" ]] || stop 'Production immutable image mismatch'
}

write_context_hashes() {
  local context="$1" output="$2"
  (cd "$context" && find . -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum) >"$output"
}

verify_context_hashes() {
  local context="$1" evidence="$2"
  [[ -s "$evidence" ]] || stop 'build-context SHA-256 evidence missing'
  (cd "$context" && sha256sum --check "$evidence") || stop 'build context differs from verified material'
}

