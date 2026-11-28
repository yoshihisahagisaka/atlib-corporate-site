#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/common.sh"
[[ "${1:-}" == '--execute' ]] || stop 'On-Demand Scan requires explicit --execute approval'
artifact_root="${2:-}"; digest_uri="${3:-}"
[[ -n "$artifact_root" && "$digest_uri" =~ @sha256:[0-9a-f]{64}$ ]] || stop 'usage: scan-production-candidate.sh --execute ARTIFACT_ROOT IMAGE_URI@sha256:DIGEST'
require_commands gcloud jq curl
[[ -s "$artifact_root/build-evidence.json" ]] || stop 'build evidence missing'
[[ "$(jq -r '.digestUri' "$artifact_root/build-evidence.json")" == "$digest_uri" ]] || stop 'scan digest differs from the built immutable digest'

gcloud artifacts docker images scan "$digest_uri" --remote --async --location=asia --project="$project" --format=json >"$artifact_root/scan-operation-submit.json" || stop 'scan submission failed; do not retry automatically'
operation="$(jq -er '.name // .operation.name' "$artifact_root/scan-operation-submit.json")" || stop 'scan Operation ID missing'
[[ "$operation" == projects/*/locations/asia/operations/* ]] || stop 'unexpected scan Operation ID'
operation_url="https://ondemandscanning.googleapis.com/v1/$operation"
for _ in $(seq 1 60); do
  token="$(gcloud auth print-access-token)" || stop 'access token unavailable while reading scan operation'
  curl --fail --silent --show-error -H "Authorization: Bearer $token" "$operation_url" >"$artifact_root/scan-operation.json" || stop 'scan operation read-back failed'
  [[ "$(jq -r '.done // false' "$artifact_root/scan-operation.json")" == true ]] && break
  sleep 10
done
[[ "$(jq -r '.done // false' "$artifact_root/scan-operation.json")" == true ]] || stop 'scan operation did not complete within the bounded wait'
jq -e 'has("error") | not' "$artifact_root/scan-operation.json" >/dev/null || stop 'scan operation completed with an error'
resource_uri="$(jq -r '.metadata.resourceUri // empty' "$artifact_root/scan-operation.json")"
[[ "$resource_uri" == "$digest_uri" ]] || stop 'scan Operation resource digest mismatch'
scan_id="$(jq -er '.response.scan' "$artifact_root/scan-operation.json")" || stop 'Scan ID missing'
gcloud artifacts docker images list-vulnerabilities "$scan_id" --location=asia --project="$project" --format=json >"$artifact_root/vulnerabilities.json" || stop 'complete vulnerability results unavailable'
jq '{CRITICAL:0,HIGH:0,MEDIUM:0,MODERATE:0,LOW:0,UNKNOWN:0} + ([.[] | (.vulnerability.effectiveSeverity // .vulnerability.severity // .effectiveSeverity // .severity // "UNKNOWN")] | group_by(.) | map({key:.[0],value:length}) | from_entries)' "$artifact_root/vulnerabilities.json" >"$artifact_root/severity-counts.json"
critical="$(jq -r '.CRITICAL // 0' "$artifact_root/severity-counts.json")"; high="$(jq -r '.HIGH // 0' "$artifact_root/severity-counts.json")"
provider_critical="$(jq '[.[] | select((.vulnerability.providerSeverity // .providerSeverity // "") == "CRITICAL")] | length' "$artifact_root/vulnerabilities.json")"
jq -n --arg digestUri "$digest_uri" --arg operation "$operation" --arg scanId "$scan_id" --argjson counts "$(cat "$artifact_root/severity-counts.json")" --argjson providerCritical "$provider_critical" \
  '{digestUri:$digestUri,operation:$operation,scanId:$scanId,counts:$counts,providerSeverityCritical:$providerCritical}' >"$artifact_root/scan-evidence.json"
[[ "$critical" == 0 && "$high" == 0 && "$provider_critical" == 0 ]] || stop 'vulnerability Gate failed: Critical/High/provider Critical detected'
printf 'OPERATION_ID=%s\nSCAN_ID=%s\nCOUNTS=%s\nSCAN_GATE=PASS\n' "$operation" "$scan_id" "$(jq -c . "$artifact_root/severity-counts.json")"

