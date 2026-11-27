# PR #82 — v3.7 release ledger / Decision record

Status: release candidate accepted; Production promotion pending.

## Authority

- Issue #81 / Draft PR #82; Git predecessor `e672c0db82df65332b1f2631f5576adcf07c295a`.
- R5-B historical manifest is retained unchanged. This successor is defined by `scripts/production-overlay/v37/manifest.json` and `patch_routes.py`.
- Production base `corporate-site-00068-xig` / `sha256:ed87a672073ad6bf3c8ee076b6fa8d0b4b71352d19c815c7a31dffdcb3dcf472`.
- v3.6 public overlay: 17 exact files, Image `sha256:a5e0ec66a4f7616a532e48e01ba7c9efc469347c1c1d4e7a586761e9373549ae`.
- v3.7 runtime overlay: existing corporate route table gains 3 entries; only `dist/server.js` changes. TypeScript counterpart synchronized. Existing runtime/Git baseline differences are not reconciled by a full source rebuild; use verified immutable candidate for promotion.
- Staging `corporate-site-staging-00046-dug`, Image `sha256:f6c78808fcbc36dabaf6e3b43892e5c2e9b47dd4db16edc143462741d03095ed`, Build `31b773cd-4fe7-415d-bb00-e1803ece4680`, Scan `822ca557-8118-47d8-95bd-3c96c1b1a266`.

## Accepted scope and gates

- SECU:MIE branding, mobile decorative-image suppression, service guide (31 requests), casual/security consulting pages, note font, SecureNavi, service navigation and SEO/AIO.
- Human design approval; zero vulnerability findings; HTTP header parity 8/8; SEO preflight 8/8 on v3.6, approved content retained by v3.7.
- Browser gate 56 cases: 49 PASS + 7 contact cases with Staging Turnstile 110200 explicitly deferred to Production. Production Turnstile and contact confirmation pending.
- Lighthouse 12.8.2 / Chrome 158.0.8127.38 / Node 24.18.0; 24 valid mobile runs. Median: home 78, services 75, company 87, works 86, contact 85, casual 86, security 85, guide 86. All >=70. Evidence `evidence-v37-r3-20261128-041141-711`.
- SECU:MIE formal URL publication is owned by the separate lane and is not a corporate release gate. Keep official links and union QR page accessible without corporate navigation to it. SecureNavi registration accepted by owner; no extra evidence gate.
- Git sync: exact 17 public paths plus the 3-line TypeScript routing change, independently checked against approved overlays. Regression expectations updated only for approved URL, service names and note font changes. Historical overlay manifest remains immutable.

## Promotion

No production deploy or traffic change has been performed by this Git sync. Promote only the verified candidate digest after the remaining Git gates; retain rollback `corporate-site-00068-xig`. Record actual revision, traffic, read-only smoke, and contact verification after release.
