# TypeScript C2 Job local integration evidence and build handoff

Date: 2026-10-24 JST. Baseline PR #44 HEAD: `9f70dcc30f2d67aa928fe18db834a6aeab8969ff`.
Canonical: parent C1/C2 contracts, TypeScript migration Decision, compatibility acceptance, SG-1 prebuild report and PowerShell implementation. Existing PowerShell assets and 35-case golden fixtures are unchanged. No new architecture, IAM or network design.

## Changes

- Generated npm lockfile with TypeScript 7.0.2, including optional Linux compiler packages. `npm ci` succeeds. Explicit test filenames support Node 20 on Windows as well as Linux (Node 20 does not expand the previous Windows wildcard).
- Added typecheck/start scripts. Existing entrypoint compiles without introducing runtime npm dependencies.
- Added storage HTTP bucket/method/create-only checks, exported transport functions for offline tests, and safe `SECRET_MOUNT_UNAVAILABLE` for mount read errors. DNS transport has no method parameter and always calls fetch with GET. Storage transport rejects DNSFilter origins, other buckets, and writes without the zero-generation precondition.
- Docker build validates digest syntax/Node major 20 and checks baked policy against SOURCE_SHA; runtime remains non-root. Cloud Build specifies linux/amd64 and the observed official Node digest. No deploy step.
- Added child-process Job tests with synthetic policy/mount/metadata/DNS/GCS boundaries. Stateful GCS reads the actual POST bytes and checks generation/object identity. No real HTTP is performed in these tests.

## Executed evidence

Node 20.20.2, npm 11.16.0, TypeScript 7.0.2, Windows. `npm ci`, `npm run typecheck`, and `npm test` (including normal emit) PASS. Existing 41 tests retained; 21 Job subprocess tests and 7 transport tests added: **69 PASS / 0 FAIL / 0 SKIP**.

Coverage: policy/parent/mode/version/argument rejection, Cloud Run job/execution presence, metadata identity, secret mount failures, authenticated GET-only discovery, 401/403/redirect/network/abort, metadata token failure, create-only, lost create response/no resend, conflict/no resend, pinned readback, hash tampering, receipt/STOP exit 0/1, synthetic secret/token/exception text excluded from stdout/stderr. Timeout test uses a real AbortSignal expiry shortened to 1ms at the test boundary and asserts the production 30000ms deadline. It does not claim real network timing.

Docker Engine probe failed with permission denied at dockerDesktopLinuxEngine. Buildx manifest inspection also failed on its local lock permission. No permissions were changed. **Local Docker build/run, Linux compiler execution and container mount behaviour remain UNVERIFIED**; Windows Node subprocess success does not replace them.

## Official base image evidence

Read-only anonymous Docker Hub Registry v2 metadata, observed 2026-10-24 02:36 UTC (11:36 JST):

- Tag: `docker.io/library/node:20-bookworm-slim`
- OCI index: `sha256:2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0193e162b5febfc0`
- linux/amd64 manifest: `sha256:3d0f05455dea2c82e2f76e7e2543964c30f6b7d673fc1a83286736d44fe4c41c`
- Direct digest re-read returned the same manifest digest. Config `sha256:9da6b4e352d0d5c94963eba1832408f5b7b08839cd8be9b6610c05de5118c704` reports linux/amd64 and `NODE_VERSION=20.20.2`.
- Cloud Build pins `node@sha256:3d0f05455dea2c82e2f76e7e2543964c30f6b7d673fc1a83286736d44fe4c41c`. Index and platform digest are distinguished. No image layers or real secrets were retrieved.

## Reused configuration and later approved build

Use existing parent `runtime-policy.template.json`, `job.template.yaml`, `render-c1.ps1` and `iam.proposal.json`. They are language-neutral configuration/render assets and remain unchanged; do not use the parent PowerShell Dockerfile/cloudbuild for this Node build.

1. Review/fix the approved source SHA. Use the existing renderer from the parent directory with that SHA and the approved numeric Secret version, in a new output directory. It validates fixed DryRun, allowlist, parent prohibition and secret version/resource/path. No Secret payload is needed for rendering.
2. Stage only this TypeScript directory's Dockerfile, package/lock, tsconfig, src and the rendered `runtime-policy.json`. The Node `.dockerignore` excludes tests, dependencies, reports and unrelated files from COPY/build context. Do not commit generated policy or credentials.
3. Only after separate build approval, use this directory's `cloudbuild.yaml` with `_SOURCE_SHA`; `_NODE_BASE_IMAGE` is digest-pinned. Build SA selection remains an existing unresolved governance gate. No Cloud Build was submitted here.
4. Record Build ID/source SHA/base digest/output image digest. Re-render the existing Job template with the same SHA/Secret version and verified image digest/project number. Compare the rendered policy to the build input. Keep dedicated SA, numeric secret volume mount, task1/parallel1/retry0, timeout900, 1CPU/1GiB and no overrides unchanged.
5. Before any approved deployment/run, verify fresh actual IAM/Job/Secret metadata and the existing SG-1 gates. No Scheduler, claims, uninstall or Organization DELETE is connected.

Local reproduction on Node 20: `npm ci`, `npm run typecheck`, `npm test`. `npm start` is the production entrypoint and requires the baked `/app/runtime-policy.json`, Cloud Run environment, metadata identity and mounted secret. Do not run it against live infrastructure during local testing; the tests inject all external boundaries in subprocesses.

## Remaining gates and rollback

Existing SG-1 unresolved Registry/Build identity/effective IAM, dedicated resource existence, Secret numeric version, bucket UBLA/PAP/retention/access, logging visibility and data classification remain unresolved. Real DNSFilter schema/pagination, metadata/Secret access, GCS preconditions and readback, Cloud Run spec/exit/log behaviour and Linux Docker build/run are not PASS.

Code rollback is confined to this development branch. Later operational rollback follows the existing Runbook: stop further dedicated Job starts; restore an approved image/Secret-version pair only after review. An invalidated key is not recoverable by image rollback. Keep plan/claim evidence; never retry unknown writes or unlock claims automatically.

GCP resources/IAM/Secret/Cloud Build/Cloud Run operations: **0**. DNSFilter real API/Agent uninstall/Organization DELETE: **0**. Production/main changes: **0**. Stop for orchestration review after PR update.
