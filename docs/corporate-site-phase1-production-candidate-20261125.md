# Corporate Site Renewal Phase 1 — Production Candidate preparation

Status: preparation only / Production NO-GO  
Issue: #81 / Draft PR: #82  
Approved source: `eb58f9c75b2ec9f0e4560903bffd81af1b56f030`
Git base: `45533d6c3e6e2995499fb3923230992442156105`

## Production read-back (2026-11-25 JST)

Read-only Cloud Run inspection matched the approved precondition:

- Project/region/service: `atlib-corporate-site` / `asia-northeast1` / `corporate-site`
- 100% revision: `corporate-site-imv-20261123071048`
- Immutable image: `asia-northeast1-docker.pkg.dev/atlib-corporate-site/cloud-run-source-deploy/corporate-site-recruit-overlay@sha256:0653f45d969ff4eaab604534adb3cbc0ed8c856e722e2e76546f0a9babc46baa`
- Runtime identity: `corporate-site-production@atlib-corporate-site.iam.gserviceaccount.com`
- Ingress: `internal-and-cloud-load-balancing`; concurrency 10; max instances 2
- Existing environment keys and Secret references remain present. Secret values were not read or recorded.

No Cloud Build, Artifact Registry push, Cloud Run deploy/traffic update, IAM/Secret, DNS, LB, TLS, or merge was performed.

## Overlay contract

The candidate is derived from the immutable Production image, not from the Git Dockerfile. `prepare-production-overlay.ps1` extracts `/app` from that digest, generates the exact approved Git Base-to-content-HEAD diff for the allowlist, requires `git apply --check` against the extracted Production files, applies it once, then verifies the full before/after trees. A candidate cannot be prepared when a patch hunk is ambiguous or inapplicable. A later evidence/control commit is permitted only when the eight current content blobs remain byte-identical to approved content HEAD `eb58f9c75b2ec9f0e4560903bffd81af1b56f030`.

Only these eight paths may differ:

1. `public/index.html`
2. `public/services/index.html`
3. `public/company/index.html`
4. `public/works/index.html`
5. `public/contact/index.html`
6. `public/css/atlib-service-renewal.css`
7. `public/images/partner_logo_mixi.png` (explicit official-asset exception)
8. `public/images/isms-gcerti-gijp-1167-ic.png` (explicit official-asset exception)

The resulting Dockerfile uses the exact Production digest as `FROM` and has eight explicit `COPY` statements. It never copies Git's complete `public` tree. The manifest is `scripts/production-overlay/manifest.json`.

## Preservation and difference gate

`overlay-verifier.cjs` hashes every extracted file before and after. It fails on any changed path outside the eight-file allowlist and separately protects:

- all `public/images/**` and `public/js/**` files except the two individually allowlisted official logo assets;
- `public/css/style.css`, `public/css/atlib.css`, and `public/css/services.css`;
- the existing home first-view/slider block;
- support-results HTML;
- photo-gallery HTML;
- mission and 100-year vision HTML.

The candidate must also retain the Production-public transformations already in the base image: no preview banner/text, public robots behavior, Production canonical/SEO, contact configuration behavior, host routing, legacy LPs, recruitment site, privacy and harassment-policy routes, and private partner boundaries. These are tested after the image is built; the overlay step must not attempt to regenerate them from Git.

## Prepared scripts

- `prepare-production-overlay.ps1`: read-back, immutable image extraction, one-time patch, hashes, build-context preparation. STOPs when Docker is unavailable, output exists, or any precondition differs.
- `prepare-production-overlay.sh`: Cloud Shell equivalent. It reuses the same manifest and Node verifier, writes the binary Git diff directly to a file, requires `git apply --check`, and records every build-context SHA-256.
- `build-production-candidate.sh`: independent Cloud Build Gate. It repeats Production/content/context read-back and distinguishes a proven missing tag from permission/API/network failures.
- `scan-production-candidate.sh`: independent immutable-digest On-Demand Scan Gate. It records Operation, Scan ID, full findings and severity counts, and requires Critical 0 / High 0.
- `deploy-isolated-candidate.sh`: independent 0%-traffic Gate. It requires the scanned digest, preserves the existing 100% Revision, and compares Runtime configuration after deployment.
- `build-production-candidate.ps1`: separately approved Cloud Build submit. Requires `-Execute`, a unique image tag, and existing verification evidence.
- `scan-production-candidate.ps1`: one On-Demand Scan of an immutable digest. Requires `-Execute`; never retries automatically.
- `deploy-isolated-candidate.ps1`: future 0%-traffic deploy only. Requires `-Execute`, a new short tag, and re-verifies the old 100% revision before and after.
- `rollback-production.ps1`: future explicit rollback to the recorded Production revision, with Ready and traffic read-back.

Cloud Build uses `cloudbuild.production-overlay.yaml` and the generated context containing only `Dockerfile` plus `overlay/`.

## Cloud Shell copy/paste: Production image extraction and overlay verification

The following is the complete preparation Gate. It performs read-only Production checks plus local Docker extraction and verification. It does not submit a Build, push an image, scan, or deploy.

```bash
set -euo pipefail
git clone https://github.com/yoshihisahagisaka/atlib-corporate-site.git
cd atlib-corporate-site
git fetch origin refs/pull/82/head
git checkout --detach FETCH_HEAD
git status --short
gcloud config set project atlib-corporate-site
bash scripts/production-overlay/prepare-production-overlay.sh "$HOME/atlib-production-overlay-artifacts"
```

Expected artifact directory:

```bash
ARTIFACT_ROOT="$HOME/atlib-production-overlay-artifacts/eb58f9c75b2ec9f0e4560903bffd81af1b56f030"
jq . "$ARTIFACT_ROOT/overlay-verification.json"
cat "$ARTIFACT_ROOT/build-context.sha256"
```

The script verifies that the eight checked-out content blobs remain identical to approved content HEAD `eb58f9c75b2ec9f0e4560903bffd81af1b56f030`; therefore the later control/evidence commit may differ without changing candidate content. Earlier Build, Scan, and Deploy evidence belongs to the previous candidate and is not valid for this content HEAD.

The subsequent commands are intentionally separate and must only be run under their corresponding approvals:

```bash
# Build Gate only
bash scripts/production-overlay/build-production-candidate.sh --execute "$ARTIFACT_ROOT" \
  asia-northeast1-docker.pkg.dev/atlib-corporate-site/cloud-run-source-deploy/corporate-site-renewal:REPLACE_WITH_NEW_UNIQUE_TAG

# Scan Gate only; copy the immutable digest URI emitted by the Build Gate
bash scripts/production-overlay/scan-production-candidate.sh --execute "$ARTIFACT_ROOT" \
  REPLACE_WITH_IMAGE_URI@sha256:REPLACE_WITH_DIGEST

# Isolated Deploy Gate only; requires the same digest in scan-evidence.json
bash scripts/production-overlay/deploy-isolated-candidate.sh --execute "$ARTIFACT_ROOT" \
  REPLACE_WITH_IMAGE_URI@sha256:REPLACE_WITH_DIGEST REPLACE_WITH_SHORT_TAG
```

The isolated run.app URL is evidence of Revision reachability only. It is not a public-host acceptance result, and the existing LB/Host boundary must not be relaxed.

## Execution sequence for a separately approved gate

1. Use a clean worktree. The preparation script verifies all eight content blobs against the manifest content HEAD, independently of a later evidence/control commit. Run `npm ci`, Build, `test:corporate-renewal`, `test:production-overlay`, `test:service-web`, and the established baseline suite.
2. On a Windows host or Cloud Shell with Docker and authenticated Artifact Registry access, run `prepare-production-overlay.ps1`. Do not reuse an existing output directory.
3. Review `approved.patch`, `overlay-verification.json`, the eight candidate files, and Production transformation checks.
4. With explicit Build approval, call `build-production-candidate.ps1 -Execute` using a new unique tag. Record Build ID and immutable digest; never overwrite an existing tag.
5. With explicit scan approval, call `scan-production-candidate.ps1 -Execute` once. Retrieve the Operation/Scan IDs and all vulnerabilities. Critical 0 / High 0 is required; unresolved scan state is not PASS.
6. Reconfirm Production revision/digest/traffic/settings. With separate deployment approval, call `deploy-isolated-candidate.ps1 -Execute`. Existing Production stays 100%; candidate remains 0% and tagged.
7. Inspect the tagged Revision's digest and settings. The run.app tag may be blocked by the existing LB-only ingress and cannot prove real-host routing. Perform read-only health/static checks where reachable; do not POST forms or send mail without a separate approval.
8. Under a later host-correct acceptance gate, verify Corporate pages, LPs, diagnostics, SECU:MIE WEB, Recruit, policies, contact GET/UI, private partner boundaries, CSP/SEO/canonical/robots, PC/mobile layout, console/page/resource errors, and Cloud Run ERROR logs.
9. Promotion is a later explicit gate. Record `corporate-site-imv-20261123071048` as rollback before traffic movement. On any post-promotion critical regression, execute the reviewed rollback script and read back 100% traffic.

## Vulnerability scan result requirements

Scan the built immutable digest only. Record Build ID, image digest, Operation ID, Scan ID, and CRITICAL/HIGH/MEDIUM/LOW/UNKNOWN counts, including fix availability. STOP on Critical/High, digest mismatch, scan failure, missing results, or any temptation to substitute an external private-image scanner.

## STOP conditions

- approved content HEAD/base, eight-file blob, or clean-worktree mismatch;
- Production revision, digest, 100% traffic, SA, Secret references, ingress, scaling, concurrency, or public-mode state differs from the approved read-back;
- Docker/Artifact Registry access unavailable;
- Base→HEAD patch is not uniquely applicable to extracted Production HTML;
- any path outside the eight-file manifest changes;
- any protected asset or protected HTML block hash changes;
- Production-public transformation, host boundary, LP/Recruit/policy/contact behavior is lost;
- build, digest read-back, vulnerability scan, isolated deploy, or setting comparison fails or becomes unknown;
- any Production traffic, IAM, Secret, DNS/LB/TLS, WordPress/GCE, or form/mail action occurs without its separate approval.

## Validation completed in this preparation gate

- Git HEAD and clean-worktree preflight: PASS before changes.
- Production read-only revision/image/traffic/configuration preflight: PASS.
- Build (`tsc`): PASS.
- Renewal contract tests: 9 PASS / 0 FAIL.
- Service-web regression tests: 7 PASS / 0 FAIL.
- Established baseline suite: 26 PASS / 3 known FAIL; no FAIL increase.
- Overlay and Cloud Shell contract tests: 6 PASS / 0 FAIL, including exact eight-file Base-to-HEAD diff, protected home blocks, unauthorized JS rejection, build-context allowlisting, and independent Gate contracts.
- PowerShell parser validation for all prepared scripts: PASS.
- Bash parser validation for all Cloud Shell scripts: PASS.
- Explicit-approval STOP tests for Build, Scan, and isolated Deploy: 3 PASS / 0 FAIL.
- Existing PR #82 Build, contract tests, service-web tests and browser evidence remain the source acceptance evidence.

Not executed: immutable image extraction/dry-run against `/app` (Docker CLI unavailable locally), Cloud Build, push, digest scan, isolated deploy, tag URL checks, real-host acceptance, traffic change, rollback exercise, or merge.
