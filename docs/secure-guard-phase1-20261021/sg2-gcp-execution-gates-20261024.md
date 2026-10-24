# Secure Guard SG-2｜実GCP構築の統括実行ゲート（承認前）
Date: 2026-10-24 JST
Status: **PLAN ONLY / CHANGE NO-GO until explicit approval**
Canonical: Draft PR #44 HEAD c13630155a3198b567d7573d27da0fd56d3883c9; TypeScript C2 69 PASS/0 FAIL, Docker Engine unavailable. Existing SG-1/C1/C2 contracts and PowerShell runbooks are authoritative for safety semantics.

## 既存実測を継承
- Project msp-zabbix, region asia-northeast1, project number 135863453696.
- Artifact Registry cloud-run-source-deploy, STANDARD DOCKER. Individual get-iam-policy returned null; inherited IAM must be considered.
- Cloud Build default and recent successful build SA: 135863453696-compute@developer.gserviceaccount.com, project roles/editor and roles/cloudsql.client. Existing broad grants are not a justification to grant new broad permissions; Runtime SA is separate.
- Dedicated secure-guard-job-sa, secure-guard-dnsfilter-api-key, secure-guard-cancellation, msp-zabbix-secure-guard-offboarding-audit: previous exact GET returned NOT_FOUND/404; **fresh pre-create recheck mandatory**, do not assume continued absence.
- Organization 273205071203 has no folder. Organization deny policy listing denied with iam.googleapis.com/denypolicies.list. This is UNVERIFIED, not proof of no deny. Do not grant broad rights to work around it.
- Logging _Default ACTIVE 90d, _Required ACTIVE locked 400d. Application log routing and viewers require scoped confirmation. No new Logging bucket by default.
- Node 20.20.2 linux/amd64 base manifest pinned in TypeScript cloudbuild.yaml, verify exact digest against approved source and final image digest.
- Source/build/deploy identity and Secret numeric version must be tied to one immutable release receipt.

## Scope and fixed protections
1. Only dedicated resources in msp-zabbix. Existing Sales Tools/Portal/Send/PPAP/Cloud SQL/production secrets untouched.
2. Dedicated GCS bucket in asia-northeast1, UBLA=true, PAP=enforced, no public principals. No retention lock, lifecycle auto-delete or versioning initially; retention/legal governance remains an explicit follow-up. Protect claims from deletion; never assume app prefixes create IAM isolation.
3. Dedicated runtime SA receives secretAccessor only on dedicated secret, custom bucket-scoped storage.objects.create/get only. No object list/update/delete/admin, no editor/owner. IAM propagation and inherited access must be checked. Separate build/deploy operator and runtime identity.
4. Job 1 task/parallel1/retry0/timeout900, image by verified digest, policy baked to exact source SHA, numeric Secret volume key/path, fixed DryRun test Organization 10220954 and MSP ID 11473; atLIB Organization 10220948 is not the MSP identifier. No Scheduler or args overrides; caller role scoped to this Job and no run.jobs.runWithOverrides effective permission.
5. GET-only DNSFilter, no uninstall, no Organization DELETE. GCS dryruns prefix create-only ifGenerationMatch=0, generation-pinned readback, hash/content verification, no resend on UNKNOWN. Claim/audit mutation path disconnected.
6. No raw secrets, tokens, Authorization, hostname lists or raw response bodies in Cloud Logging or build substitutions. DryRun object contains allowlisted inventory and needs limited reader access.

## Ordered gated changes
**Gate A — Fresh Read-only preflight**: confirm PR/source SHA and renderer output; Registry IAM/config, effective build/deploy permissions incl relevant inherited/deny unknown, dedicated 4 names current state, logging destination/viewers, approved operator identity, bucket global-name conflict handling. Distinguish 403/404. Record non-secret evidence privately.
**Gate B — Build-only approval**: use existing build SA only if explicitly accepted after review; stage minimal TypeScript directory with rendered non-secret runtime-policy.json and lockfile. Submit Cloud Build with pinned base digest, no deploy step. Record build ID, SHA, output image digest and source label. Stop on mismatch/build failure.
**Gate C — Dedicated infrastructure approval**: create SA, bucket, custom bucket-scoped role/bindings, Secret metadata and approved numeric version through secure entry (never chat/git/build args), then Job using verified image digest. Compare actual Job spec, mount, IAM, no overrides, bucket protection, logging.
**Gate D — GET-only live E2E approval**: run only fixed test Organization; verify metadata SA, mounted Secret, actual schema and complete Site/Agent inventory, GCS create-only + pinned readback, receipt, no mutation requests. A 412 or unknown write stops; do not retry by changing hash/operation ID.
**Gate E — separate C3/C4/C5**: claim/audit real-GCS, Agent uninstall/restore, Organization DELETE each requires its own approval and evidence. No automatic escalation from GET PASS.

## Stop/rollback
- Build failure: no deploy; leave existing workloads untouched. Record error without secrets.
- Job failure: disable future invocations; preserve GCS plan/claim/audit; no auto retry or object deletion.
- IAM correction: revert only newly introduced dedicated bindings, not project IAM wholesale.
- Image rollback only to an approved image + still-valid numeric Secret version pair. Key invalidation cannot be reversed by image rollback.
- Bucket retention and claim manual resolution are governance decisions; do not improvise automatic cleanup.
- Commercial launch remains separate after operations readiness.

## Unresolved approval inputs
1. Named human operator and separate build/deploy principal (whether to temporarily use existing Compute Default Editor build SA).
2. Exact IAM review, including organization deny policy visibility gap and effective no-overrides check.
3. Data retention and authorized readers for GCS plan/claim/audit; logging viewers/routing.
4. Secure registration of dedicated DNSFilter key numeric version; test-org scope and API access.
5. Explicit approval for each mutation gate B/C/D; no approval implied by this document.

No GCP, DNSFilter, Production or main changes in this documentation-only step.
