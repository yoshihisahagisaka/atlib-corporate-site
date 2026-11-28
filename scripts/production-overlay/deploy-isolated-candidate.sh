#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/common.sh"
[[ "${1:-}" == '--execute' ]] || stop 'isolated deploy requires explicit --execute approval'
artifact_root="${2:-}"; digest_uri="${3:-}"; traffic_tag="${4:-}"
[[ -n "$artifact_root" && "$digest_uri" =~ @sha256:[0-9a-f]{64}$ && "$traffic_tag" =~ ^[a-z0-9-]{1,40}$ ]] || stop 'usage: deploy-isolated-candidate.sh --execute ARTIFACT_ROOT IMAGE_URI@sha256:DIGEST SHORT_TAG'
require_commands gcloud jq diff
[[ -s "$artifact_root/scan-evidence.json" ]] || stop 'scan PASS evidence missing'
[[ "$(jq -r '.digestUri' "$artifact_root/scan-evidence.json")" == "$digest_uri" ]] || stop 'deploy digest differs from scanned digest'
[[ "$(jq -r '.counts.CRITICAL // 0' "$artifact_root/scan-evidence.json")" == 0 && "$(jq -r '.counts.HIGH // 0' "$artifact_root/scan-evidence.json")" == 0 ]] || stop 'scan Critical/High Gate is not PASS'
read_production_state "$artifact_root/production-service-deploy-before.json" "$artifact_root/production-revision-deploy-before.json"
[[ "$(jq --arg tag "$traffic_tag" '[.status.traffic[] | select(.tag == $tag)] | length' "$artifact_root/production-service-deploy-before.json")" == 0 ]] || stop 'traffic tag already exists'
jq -S -f "$overlay_dir/runtime-contract.jq" "$artifact_root/production-revision-deploy-before.json" >"$artifact_root/runtime-contract-before.json"

gcloud run deploy "$service" --project="$project" --region="$region" --image="$digest_uri" --no-traffic --tag="$traffic_tag" || stop 'deploy failed or state is unknown; do not retry automatically'
gcloud run services describe "$service" --project="$project" --region="$region" --format=json >"$artifact_root/production-service-deploy-after.json" || stop 'post-deploy service read-back failed'
[[ "$(jq '[.status.traffic[] | select(.percent == 100)] | length' "$artifact_root/production-service-deploy-after.json")" == 1 ]] || stop 'Production 100% traffic is not singular after deploy'
[[ "$(jq -r '.status.traffic[] | select(.percent == 100) | .revisionName' "$artifact_root/production-service-deploy-after.json")" == "$(manifest_value '.productionRevision')" ]] || stop 'existing Production 100% traffic was not preserved'
candidate_revision="$(jq -er --arg tag "$traffic_tag" '.status.traffic[] | select(.tag == $tag) | .revisionName' "$artifact_root/production-service-deploy-after.json")" || stop 'isolated tagged Revision missing'
[[ "$(jq -r --arg tag "$traffic_tag" '.status.traffic[] | select(.tag == $tag) | .percent // 0' "$artifact_root/production-service-deploy-after.json")" == 0 ]] || stop 'candidate received traffic unexpectedly'
gcloud run revisions describe "$candidate_revision" --project="$project" --region="$region" --format=json >"$artifact_root/candidate-revision.json" || stop 'candidate Revision read-back failed'
[[ "$(jq -r '.status.imageDigest' "$artifact_root/candidate-revision.json")" == "$digest_uri" ]] || stop 'deployed candidate digest mismatch'
jq -S -f "$overlay_dir/runtime-contract.jq" "$artifact_root/candidate-revision.json" >"$artifact_root/runtime-contract-candidate.json"
jq '(.containers[].image) = "<IMAGE>"' "$artifact_root/runtime-contract-before.json" >"$artifact_root/runtime-contract-before-normalized.json"
jq '(.containers[].image) = "<IMAGE>"' "$artifact_root/runtime-contract-candidate.json" >"$artifact_root/runtime-contract-candidate-normalized.json"
diff -u "$artifact_root/runtime-contract-before-normalized.json" "$artifact_root/runtime-contract-candidate-normalized.json" >"$artifact_root/runtime-contract.diff" || stop 'candidate Runtime settings differ from Production baseline'
before_service_contract="$(jq -c '{ingress:.metadata.annotations["run.googleapis.com/ingress"],defaultUrlDisabled:(.metadata.annotations["run.googleapis.com/default-url-disabled"] // null)}' "$artifact_root/production-service-deploy-before.json")"
after_service_contract="$(jq -c '{ingress:.metadata.annotations["run.googleapis.com/ingress"],defaultUrlDisabled:(.metadata.annotations["run.googleapis.com/default-url-disabled"] // null)}' "$artifact_root/production-service-deploy-after.json")"
[[ "$before_service_contract" == "$after_service_contract" ]] || stop 'service ingress/default URL boundary changed'
printf 'ISOLATED_REVISION=%s\nTAG_URL=%s\nTRAFFIC=0\n' "$candidate_revision" "$(jq -r --arg tag "$traffic_tag" '.status.traffic[] | select(.tag == $tag) | .url' "$artifact_root/production-service-deploy-after.json")"

