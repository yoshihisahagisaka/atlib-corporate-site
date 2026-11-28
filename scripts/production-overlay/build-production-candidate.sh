#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/common.sh"
[[ "${1:-}" == '--execute' ]] || stop 'Cloud Build requires explicit --execute approval'
artifact_root="${2:-}"; candidate_image="${3:-}"
[[ -n "$artifact_root" && -n "$candidate_image" ]] || stop 'usage: build-production-candidate.sh --execute ARTIFACT_ROOT IMAGE_URI:UNIQUE_TAG'
[[ "$candidate_image" =~ ^asia-northeast1-docker\.pkg\.dev/atlib-corporate-site/[^:]+:[a-zA-Z0-9._-]+$ ]] || stop 'candidate must be an approved Artifact Registry URI with a unique tag'
require_commands git gcloud jq node sha256sum
assert_clean_approved_content
read_production_state "$artifact_root/production-service-build-gate.json" "$artifact_root/production-revision-build-gate.json"
[[ -s "$artifact_root/overlay-verification.json" ]] || stop 'overlay verification evidence missing'
node "$overlay_dir/overlay-verifier.cjs" "$artifact_root/base" "$artifact_root/candidate" "$manifest" "$artifact_root/overlay-verification-build-gate.json"
node "$overlay_dir/candidate-context-verifier.cjs" "$artifact_root/build-context" "$manifest" "$artifact_root/context-verification-build-gate.json"
verify_context_hashes "$artifact_root/build-context" "$artifact_root/build-context.sha256"

describe_error="$artifact_root/candidate-tag-check.stderr"
if gcloud artifacts docker images describe "$candidate_image" --project="$project" --format=json >"$artifact_root/candidate-tag-existing.json" 2>"$describe_error"; then
  stop "candidate tag already exists: $candidate_image"
fi
grep -Eiq 'NOT_FOUND|not found|does not exist' "$describe_error" || stop 'candidate tag absence could not be proven (permission/API/network error possible)'

base_image="$(manifest_value '.baseImage')"
gcloud builds submit "$artifact_root/build-context" --project="$project" --region="$region" \
  --config="$overlay_dir/cloudbuild.production-overlay.yaml" \
  --substitutions="_BASE_IMAGE=$base_image,_CANDIDATE_IMAGE=$candidate_image" \
  --format=json >"$artifact_root/cloud-build-result.json" || stop 'Cloud Build failed; do not retry automatically'
[[ "$(jq -r '.status' "$artifact_root/cloud-build-result.json")" == 'SUCCESS' ]] || stop 'Cloud Build did not return SUCCESS'
gcloud artifacts docker images describe "$candidate_image" --project="$project" --format=json >"$artifact_root/candidate-image.json" || stop 'built image read-back failed'
digest="$(jq -er '.image_summary.digest // .version | select(startswith("sha256:"))' "$artifact_root/candidate-image.json")" || stop 'immutable candidate digest missing'
digest_uri="${candidate_image%:*}@$digest"
jq -n --arg source "$(manifest_value '.headCommit')" --arg tag "$candidate_image" --arg digestUri "$digest_uri" \
  --arg buildId "$(jq -r '.id' "$artifact_root/cloud-build-result.json")" \
  '{sourceHead:$source,tag:$tag,digestUri:$digestUri,buildId:$buildId,status:"SUCCESS"}' >"$artifact_root/build-evidence.json"
printf 'BUILD_ID=%s\nIMAGE_DIGEST_URI=%s\n' "$(jq -r '.buildId' "$artifact_root/build-evidence.json")" "$digest_uri"

