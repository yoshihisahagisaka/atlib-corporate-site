# Inventory pagination evidence — 2026-10-25

## Scope

Source baseline: `0bf70584e81c97c1178f6d56d960dfc6058cc1be`.

This record captures the minimal TypeScript C1 inventory change prompted by the
current DNSFilter collection response shape. It does not record API response
bodies, credentials, hostnames, agent identifiers, or network identifiers.

## Observed collection shape

- Network: `data` array, explicit `links.next: null`, and `meta.network_count`;
  no `meta.total_count` was observed.
- Organization-wide Agent: `data` array and explicit `links.next: null`;
  `meta.total_count` was not observed.

`network_count` is not used as a completeness proof: its semantics were not
established by a response-shape observation alone.

## Contract

Pagination remains fail-closed. Every page must have a permitted URL, unchanged
scope filters, unique resource identifiers, no loop, and an explicit `links.next`.

- If every page supplies `meta.total_count`, it must be a stable safe integer and
  equal the accumulated unique row count.
- If no page supplies `meta.total_count`, completion is proven only by the
  explicit terminal `links.next: null` after the same URL, scope, uniqueness, and
  loop checks. The recorded count is the accumulated row count, with proof
  `explicit-next-null+unique-ids`.
- Mixing pages with and without `total_count` stops with
  `PAGINATION_TOTAL_CHANGED`.

Site-scoped and organization-wide Agent collections are still independently
retrieved and compared. MSP membership, Organization membership, GET-only
transport, DryRun, plan hashing, create-only GCS persistence, and UNKNOWN
no-resend behavior are unchanged.

## Verification

Node.js TypeScript strict checking passed. The full offline suite passed:
86 tests, 0 failures, 0 skips. Added coverage includes the observed terminal
Network shape (two Network rows and one Agent overall), no-total multiple-page
traversal, and retained stable-total count-mismatch rejection.

## PowerShell relationship

The legacy PowerShell C1 reference still requires `meta.total_count`; it was not
changed in this scoped TypeScript correction. Endpoint/query, relationship, and
collection-reconciliation contracts remain aligned. The pagination-proof
difference is explicit and requires review before treating the legacy PowerShell
implementation as behaviorally identical for no-total responses.
