# Secure Guard｜MSP IDとOrganization IDの訂正記録

Date: 2026-10-24 JST

## Confirmed fact
A single read-only GET for test Organization 10220954 returned HTTP 200, the expected Organization ID, and one non-conflicting `attributes.managed_by_msp_id` equal to MSP ID 11473. It did not equal atLIB Organization ID 10220948. No response body, key, or authorization value is recorded.

## Correction
`msp_parent_id` is an MSP management-subject identifier in the DNSFilter relation check. The E2E runtime policy and PowerShell default therefore use 11473. Test Organization 10220954 remains the fixed E2E allowlist entry. atLIB Organization 10220948 remains a valid Organization identifier and is deliberately not repurposed as an MSP ID.

## Scope and generic behavior
The inventory algorithm takes an Organization ID and an MSP ID as separate inputs. It accepts any synthetic customer Organization that has the configured MSP relation, rejects a different MSP, a mismatched Organization ID, and missing or conflicting relationships. This correction adds no dynamic customer selection, customer-specific code, or authorization path; the production customer/contract approval source remains unimplemented.

## Safety and next gate
GET-only DryRun, no overrides, create-only GCS readback, no resend on UNKNOWN, and disabled uninstall/delete paths are unchanged. A new build, new immutable image digest, and an approved Job update are required before another live E2E. No GCP, DNSFilter configuration, Cloud Build, or Job change is made by this correction.


## C1/C2 integration verification
The offline Job integration harness was rerun after the fixture correction. It exercises policy validation, authenticated GET-only Organization/Site/Agent inventory, DryRun plan hashing, create-only claim, generation-pinned readback, content/hash verification, and receipt generation. The normal scenario and an independently synthesized customer Organization 20990001 (with its own synthetic policy allowlist) both reached `DRYRUN_DURABLE_VERIFIED`; the latter uses the same runtime code path and writes only within its own synthetic Organization path. The suite also retains rejection of atLIB Organization ID 10220948 when presented as an MSP ID, foreign MSP relationships, missing/conflicting relations, and no-resend behavior after uncertain creation results.

Verification on 2026-10-24: strict TypeScript check, build, and 73 tests passed with 0 failures in an isolated copy of this PR. Node.js 20 was not installed in the authorized environment; the available runtime was Node.js 24.18.0, so a Node 20 rerun remains a release-gate follow-up rather than a PASS assertion. The requested `npm ci` could not download TypeScript because registry DNS resolution failed; verification used the lockfile-matched TypeScript 7.0.2 compiler already present in an earlier local validation copy. No secrets or tokens were emitted.


PowerShell compatibility verification was also rerun after its C1 fixture was aligned: 47 offline fixtures passed, including rejection of `10220948` when supplied as the MSP relation, GET-only behavior, secret non-disclosure, and no-resend UNKNOWN handling. Live DNSFilter and GCP requests remained zero.
