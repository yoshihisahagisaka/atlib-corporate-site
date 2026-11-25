#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/common.sh"
require_commands git gcloud docker node jq sha256sum find sort xargs
assert_clean_approved_content

output_root="${1:-$HOME/atlib-production-overlay-artifacts}"
approved="$(manifest_value '.headCommit')"
artifact_root="$output_root/$approved"
[[ ! -e "$artifact_root" ]] || stop "output already exists: $artifact_root"
mkdir -p "$artifact_root/base" "$artifact_root/candidate" "$artifact_root/build-context/overlay"
read_production_state "$artifact_root/production-service-before.json" "$artifact_root/production-revision-before.json"

base_image="$(manifest_value '.baseImage')"
docker pull "$base_image" || stop 'immutable Production image pull failed'
container="atlib-overlay-${approved:0:10}-$$"
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker create --name "$container" "$base_image" >/dev/null || stop 'Production image container creation failed'
docker cp "$container:/app/." "$artifact_root/base" || stop 'Production image extraction failed'
cp -a "$artifact_root/base/." "$artifact_root/candidate/"

base="$(manifest_value '.baseCommit')"
mapfile -t allowed < <(jq -er '.allowedFiles[]' "$manifest")
git -C "$repo_root" diff --binary "$base" "$approved" -- "${allowed[@]}" >"$artifact_root/approved.patch" || stop 'approved Git diff generation failed'
[[ -s "$artifact_root/approved.patch" ]] || stop 'approved Git diff is empty'
# git apply reads patch paths relative to its own cwd.  In particular,
# --git-dir/--work-tree alone does not reliably target the extracted /app tree.
# Run both gates in the isolated candidate directory; never alter the repo.
git -C "$artifact_root/candidate" apply --check --binary "$artifact_root/approved.patch" || stop 'approved patch is not uniquely applicable to Production content'
git -C "$artifact_root/candidate" apply --binary "$artifact_root/approved.patch" || stop 'approved patch application failed'

node "$overlay_dir/overlay-verifier.cjs" "$artifact_root/base" "$artifact_root/candidate" "$manifest" "$artifact_root/overlay-verification.json" || stop 'overlay verification failed'
for relative in "${allowed[@]}"; do
  mkdir -p "$artifact_root/build-context/overlay/$(dirname "$relative")"
  cp -p "$artifact_root/candidate/$relative" "$artifact_root/build-context/overlay/$relative"
done
cp -p "$overlay_dir/Dockerfile.candidate" "$artifact_root/build-context/Dockerfile"
node "$overlay_dir/candidate-context-verifier.cjs" "$artifact_root/build-context" "$manifest" "$artifact_root/context-verification.json"
write_context_hashes "$artifact_root/build-context" "$artifact_root/build-context.sha256"
printf 'PREPARED=%s\nCONTENT_HEAD=%s\nBASE_IMAGE=%s\n' "$artifact_root" "$approved" "$base_image"

