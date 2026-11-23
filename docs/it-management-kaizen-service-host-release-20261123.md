# IT経営KAIZEN LP v44 — service.atlib.jp 公開契約

Status: Draft / production not deployed
Baseline: approved local v44 `index.html` SHA256 `7f9bcfb0d38ec8e6b895f0575d46102ceb5f7925bed1332f0ee639f20c9b0ecd`, Git import `5dba3ba4bbeced33c2e58f76e11c43b3d923911b`.
Source branch: `feat/it-management-kaizen-service-release-20261123`, based on Corporate PR #74 `a7c14308a01da253d4842266ed3d9f94ac0bcb29`. PR #76 (Business Web old URL retirement) is excluded; PR #78 is an obsolete preliminary LP.

## Scope
- New canonical LP: `https://service.atlib.jp/it-management-kaizen/`, existing 7-question public intake: `https://sales.atlib.jp/it-management-kaizen/free-diagnosis/` (already implemented in Sales Tools).
- Preserve `https://service.atlib.jp/business-web/` and all unrelated Corporate/SECU:MIE/Recruit pages.
- Existing Cloud Run `corporate-site`, existing HTTPS LB/Certificate Manager and A record. No new Cloud Run service, SQL, API, DNS, OAuth or SMTP.
- No changes in Sales Tools as part of this PR. Never reuse the old LP modal/Case API.
- New service host only allows IT経営KAIZEN root/index and approved static assets; it does not expose backup/old subpaths. Business Web host contract unchanged.
- **Mandatory content isolation**: `www.atlib.jp/it-management-kaizen/*` must retain the byte-identical currently deployed legacy files until separate retirement. NEVER overlay the approved new HTML onto `/app/public/it-management-kaizen/*` in the production image. `npm run test:service-web` runs `scripts/stageItManagementServiceContent.cjs` to place ONLY the approved LP and 11 referenced assets in `dist/service-content/it-management-kaizen`; the service-host handler serves them from `/app/dist/service-content/it-management-kaizen` with `fallthrough:false` before generic WWW static delivery. In the immutable image overlay, COPY only that private staged subtree, changed service middleware and verified server code blocks (plus a one-link scoped Corporate services patch). No other static WWW contents are copied.
- Source-tree `public/it-management-kaizen/index.html` in Git is the approved staging input, NOT the deployed legacy WWW asset. In production, the old WWW file must remain untouched throughout the initial new-host launch.
- 7-question intake/Case/notification/TimeRex operation is an independent **production GO gate**. The Sales Tools `DIAGNOSIS_PUBLIC_INTAKE_ENABLED` must be checked from the actual running Revision; verify schema contract GET and test the intended application lifecycle before release.

## Content and security
- Keep all approved copy, imagery and layout. Change only the old LP canonical/OG URLs and Service/WebPage JSON-LD IDs/URLs to the service hostname; Organization remains `www.atlib.jp`.
- The two approved inline executable scripts were moved verbatim to one versioned `assets/it-management-kaizen-v44.js` for a strict `script-src 'self'` CSP, not reimplemented. Inline CSS stays under `style-src 'self' 'unsafe-inline'`. No external executable dependencies.
- Service host `robots.txt` and `sitemap.xml` list Business KAIZEN and IT経営KAIZEN; corporate WWW remains canonical for the corporate site. The corporate service introduction links directly to the new LP; old WWW LP is not used as a new entry point.
- For preview/noncanonical hostname, preserve existing global `X-Robots-Tag: noindex,nofollow`.
- `ITMGMT_WWW_RETIRE_ENABLED` defaults OFF. ONLY after service host and public intake PASS, enable the old WWW URL to return 410 with no `Location`, `Cache-Control:no-store`. No 301 to service. This is a separate, reversible release decision; old WWW HTML need not be updated.

## Production sequencing — fail closed
1. Verify branch source SHA, only scoped LP/static/service middleware/routing/internal link/tests changed; npm ci/build and `npm run test:service-web` PASS. Test old Business/WWW behavior, new LP/JS/CSS/assets, host isolation, robots/sitemap, CSP/SEO, optional 410 gate.
2. Read-only Cloud Run current 100% Revision, immutable image digest, service template/env/service account, HTTPS LB + Cloud CDN baseline; abort if current production differs from recorded baseline. Do **not** deploy Git's complete corporate image over production.
3. Build an image based on the exact existing deployed digest, applying only verified file-by-file source-level changes. Confirm **all unrelated files** are byte-identical; runtime server and middleware patches must be demonstrably exact against deployed source. New LP static assets and JS are added; existing SECU:MIE and Business Web must remain.
4. Deploy a tagged 0%-traffic candidate and test via run.app for content/assets/JS noindex. A tag's run.app Host does NOT exercise service/WWW host isolation; use host-correct staging LB or guarded real-host checks when switching.
5. Verify the real Sales Tools public Q1–Q7 contract and successful Case/notification/scheduling flow, plus authorized PC/mobile review. No real submission without explicit test approval. Check HSTS/CSP, header spoofing, service domain sitemap, new canonical, all assets, Business Web, SECU:MIE, contact and published/unpublished partner states.
6. Only explicit promotion to 100% with a verified immutable previous Revision for rollback; recheck both domains immediately. No DNS/certificate changes.
7. Separately enable `ITMGMT_WWW_RETIRE_ENABLED=true` after public GO and check WWW 410 for root, nested and assets, no Location header, plus service host 200. Because `corporate-site-bes` Cloud CDN is enabled, check host-specific cache invalidation for `www.atlib.jp/it-management-kaizen/*` when needed; never invalidate entire Corporate cache by default.

## Stopping conditions
- Public intake disabled, misconfigured, wrong live Revision, failed Case-to-TimeRex or user consent, missing any referenced images, wrong canonical/noindex behavior, CSP blocks scripts, unexpected Cloud CDN response, nonmatching immutable image, or regression in any existing service => **NO-GO**. Preserve existing traffic and revise the Draft PR.

Scope of this record is the code-level release contract. It does not assert production readiness or authorize a traffic change on its own.
