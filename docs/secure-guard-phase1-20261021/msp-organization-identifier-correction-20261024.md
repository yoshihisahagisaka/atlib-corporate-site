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
