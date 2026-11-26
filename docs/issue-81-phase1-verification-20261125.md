# Issue #81 Phase 1 verification (2026-11-25)

## Scope

- Source base: `45533d6c3e6e2995499fb3923230992442156105` (PR #79)
- Approved prototype SHA-256: `ce16aabb8c8f56da47beabc8031ffe4b589310a459dd5ac64cb07ae7e2138479`
- Implementation branch: `feat/corporate-service-renewal-20261125`
- Production build/deploy/traffic changes: none

## Automated checks

- `npm ci`: PASS
- `npm run build`: PASS
- `npm run test:service-web`: 7 PASS / 0 FAIL
- `npm run test:corporate-renewal`: 4 PASS / 0 FAIL
- `npm run test:itmgmt-browser-layout`: infrastructure FAIL before page evaluation because the sandboxed Chrome GPU process terminated (`GPU process isn't usable`). The same Chromium engine was then run with the approved unsandboxed browser execution path for the fourteen viewport checks below; no viewport was skipped.
- `npm run test:contact-api`: 26 PASS / 3 FAIL. The three failures reproduce contracts already inconsistent at the approved base HEAD: the recruit note banner assertion and the `20261119-mobile` cache-version/license-line assertions. No recruit asset, cache-version, or license-line change is included in this branch.

## Chrome browser gate

Chrome DevTools device emulation was used against the local static site. Both `/` and `/services/` were checked at 320, 390, 650, 651, 768, 1024, and 1440 CSS pixels.

- Horizontal overflow: 0/14
- Broken images: 0/14
- JavaScript exceptions/unhandled rejections: 0/14
- Mobile menu open state at 320/390/650: PASS
- Mobile menu open/close interaction at 320/390/650: PASS
- Existing home slider transition: PASS (390px, indicator-driven active slide change)
- Existing photo gallery animation: PASS (390px, transform changed during animation)
- Renewal sections: PASS at all fourteen page/width combinations

Machine-readable results: `docs/evidence/issue-81-browser/browser-gate.json`.

Screenshots:

- `docs/evidence/issue-81-browser/home-390.png`
- `docs/evidence/issue-81-browser/home-1440.png`
- `docs/evidence/issue-81-browser/services-390.png`
- `docs/evidence/issue-81-browser/services-1440.png`
- `docs/evidence/issue-81-browser/home-390-full.png` (menu closed, full page)
- `docs/evidence/issue-81-browser/services-390-full.png` (menu closed, full page)
- `docs/evidence/issue-81-browser/{kaizen,security,advisory,diagnosis}-{390,1440}.png`

The 390px screenshots intentionally record the mobile navigation in its open state.

## Design reproducibility follow-up

The limited follow-up to PR #82 changes only:

- `public/index.html`
- `public/services/index.html`
- `public/css/atlib-service-renewal.css`
- `tests/corporate-service-renewal.test.cjs`
- this verification document and browser evidence

The KAIZEN, security, casual consulting, and free-diagnosis sections were aligned with approved prototype v3. Existing images, shared CSS, JavaScript, support-results HTML, gallery, mission/vision content, LPs, and diagnostic functions remain unchanged.

## Human review final revision v2 (2026-11-26)

- Content HEAD: `72095e89170168cfe93dcdc0c267ea589c9f2402`
- Public changes are limited to `public/index.html`, `public/services/index.html`, and `public/css/atlib-service-renewal.css`.
- The existing `public/business-web/assets/gyomu-kaizen-logo.png` is referenced without modifying or duplicating the image.
- The five specified limitation/recommendation sentences were removed without replacement.
- The former execution/operation note was integrated into the new “IT経営KAIZENとは” explanation, cycle diagram, and four service cards. Legacy anchors `it-projects` and `it-bpo` remain.
- Browser Gate: 14/14 PASS at 320, 390, 650, 651, 768, 1024, and 1440 CSS pixels across `/` and `/services/`.
- Horizontal overflow, broken images, Console errors, Page exceptions, and Resource failures: 0.
- Mobile menu open/close and the existing home slider: PASS.

Machine-readable evidence: `docs/evidence/issue-81-browser/browser-gate-v2.json`.

Screenshots:

- `docs/evidence/issue-81-browser/home-{390,1440}-full.png`
- `docs/evidence/issue-81-browser/services-{390,1440}-full.png`
- `docs/evidence/issue-81-browser/management-explainer-{390,1440}.png`

## Corporate Brand Design v4 (2026-11-26)

- Content HEAD: `4fb0ad2a69a0b77fbb5addfafb8b5eb911f93622`
- Approved prototype SHA-256: `fd8cdc99de9edc4423a21ccc6948830a09a69d76ede9cf551434bb8ce79e6413`
- Top-page order was changed to perspective, values, support results, clients, concise services, gallery, mission/100-year vision, free diagnoses, and contact. Existing hero, support-result, gallery, mission/vision, shared JavaScript, and public links remain in place.
- The detailed KAIZEN diagrams and service catalog remain on `/services/`; the unchanged four-step `link5` support flow moved there from the home page.
- Eight existing client logos were restored without adding or modifying image assets. The evidence is the previous Corporate HTML plus the current `/joshisu-kaizen/` references to the same repository files: MIXI, シンエイ動画, グローバル・リンク・マネジメント, ゲンバカンリシステムズ, 大和バルブ, 藤海ビルサービス, マイクレン・ヘルスケア, and Vidaway.
- Formal current publication-permission records were not found in Git. The existing publication history supports restoration, while any future logo additions or removals remain an Owner/legal review item.
- The latest atLIB ISMS logo PDF SHA-256 is `89e172a3f411f97844e1ba828ee03b001ee5486ca6deeebeedca2dbf6c45a14e`; it identifies certification `GIJP-1167-IC` and `ISO/IEC 27001:2022`. The accompanying GCERTI usage guide SHA-256 is `526c3c5ff22e565435d5492972e0f00c4c7fe8bcb90478eb2f81dff7492c3f13`.
- The guide permits the supplied IAS + GCERTI mark on a Web site during the valid certification period. It prohibits editing (including aspect-ratio/content changes), prohibits IAF use, requires at least 12 mm width, permits only file-format conversion, and requires the certified office to be stated when a site also covers uncertified offices or out-of-scope activity. The supplied mark already contains the certification number and standard.
- Git contains ISO/IEC 27001 certification text but no ISMS logo asset or historical logo placement. Publishing the mark requires an unedited Web-format derivative, confirmation of the certified office/scope wording, and an explicit Overlay asset/allowlist approval. It was therefore not added in this gate.
- The five action principles remain on `/company/#mvv`; the company-page local navigation and all Corporate footers still label that destination “理念と行動指針”. No removal or Recruit-site change was made. Proposed later decision: keep Corporate focused on philosophy, vision, representative message, and customer value, then evaluate whether the action-principle detail should move to Recruit while retaining a Corporate summary/link.

Final CDP Browser Gate: 14/14 PASS at 320, 390, 650, 651, 768, 1024, and 1440 CSS pixels across `/` and `/services/`.

- Horizontal overflow, broken images, missing required anchors, Console errors, Page exceptions, and Resource failures: 0.
- Existing home slider, gallery animation, mobile menu open/close, official KAIZEN logos, and all eight client logos: PASS.
- Machine-readable evidence: `docs/evidence/issue-81-browser/browser-gate-v4.json`.
- Full-page screenshots: `docs/evidence/issue-81-browser/{home,services}-v4-{390,1440}-full.png`.
- Section screenshots: `docs/evidence/issue-81-browser/{home,services}-v4-feature-{390,1440}.png`.
- Final checks against Content HEAD: Build PASS; Renewal 6 PASS / 0 FAIL; Production Overlay 6 PASS / 0 FAIL; Service Web 7 PASS / 0 FAIL; established baseline 26 PASS / 3 known FAIL (no increase); `git diff --check` PASS.

## Official logo finalization (2026-11-26)

- Content HEAD: `3e9d3c75519e30dcf343ce5b1075e9addf8825ef`.
- MIXI uses the supplied transparent RGB positive PNG without recoloring, deformation, cropping, or aspect-ratio changes. Source/render SHA-256: `de166bd8fb91d8edf30f9fbaa6b01e32ef8d2d89fda98e438ab6ee2ae2b37f53`.
- ISMS uses a format-only PNG rendering of the supplied PDF page. It contains IAS + GCERTI, not IAF. PDF SHA-256: `89e172a3f411f97844e1ba828ee03b001ee5486ca6deeebeedca2dbf6c45a14e`; PNG SHA-256: `6838d56096c64059cdd5c2becdc6d3c8c5148849d4d830ac9392b32a0b92c4fc`.
- Published ISMS information is intentionally limited to the official logo, certification name `ISO/IEC 27001:2022` / `情報セキュリティマネジメントシステム`, and certificate number `GIJP-1167-IC`. Scope, certified office, validity period, and expiry are not published as text.
- The ISMS logo is present in company information and the common footer. CSS keeps its displayed width above the 12 mm Web minimum at PC and mobile widths.
- Overlay protection remains fail-closed for `public/images`; only the two named official logo assets are explicit exceptions. The candidate Dockerfile has one COPY per allowlisted path.
- Final CDP Browser Gate: 21/21 PASS across home, services, and company at 320, 390, 650, 651, 768, 1024, and 1440 CSS px. No broken image, horizontal overflow, Console/Page/Resource error, or anchor regression. MIXI decoded at 6000x3614; every ISMS rendering was visible at no less than the 12 mm Web minimum.
- Updated full-page evidence: `docs/evidence/issue-81-browser/{home,services,company}-v4-{390,1440}-full.png`; company ISMS detail: `company-v4-feature-{390,1440}.png`; machine-readable result: `browser-gate-v4.json`.
- Final checks: `npm ci` PASS; Build PASS; Renewal 7 PASS / 0 FAIL; Production Overlay 6 PASS / 0 FAIL; Service Web 7 PASS / 0 FAIL; established baseline 26 PASS / 3 known FAIL (no increase); `git diff --check` PASS.

## ISMS copy minimization (2026-11-26)

- Content HEAD: `46358b4b6bd34fe148300d9f74efc0b4e7819a41`.

## Human review final adjustments (2026-11-26)

- Previous Human-review Content HEAD: `dd0af6a1697a74a13ea2c396471bcece231bdcb6`.
- Top-page editorial headings now use balanced, Japanese-aware responsive wrapping instead of fixed line breaks. MIXI is presented in a plain bordered white display area while the supplied PNG remains byte-identical (`de166bd8fb91d8edf30f9fbaa6b01e32ef8d2d89fda98e438ab6ee2ae2b37f53`).
- The service catalogue no longer publishes the internal `準備中` / `検証中` badges or explanatory note. No new application, purchase, price, launch-date, or availability promise was added. Major service-page vertical spacing was reduced while all service diagrams, names, links, and the four-step workflow remain present.
- The public company phone row (`03-6661-1616` and its `tel:` link) was removed. The optional phone input in the contact form is user-supplied form data, not a published company contact number, and remains unchanged. No other public company phone number occurs in the five Corporate HTML files.
- GCERTI's supplied usage guide permits the GCERTI certification mark alone, requires the customer information (certificate number and standard), and sets a 12 mm minimum width. The provided current folder and its `old` folder contain only combined IAS + GCERTI PDFs. A formally supplied standalone GCERTI asset was not found. In accordance with the Owner's STOP rule, the current combined Web derivative was not cropped or altered; the IAS-removal sub-change remains blocked pending a formal standalone asset. Existing ISMS PNG SHA-256 remains `6838d56096c64059cdd5c2becdc6d3c8c5148849d4d830ac9392b32a0b92c4fc`.
- Automated verification: TypeScript Build PASS; Corporate Renewal 8/8 PASS; Production Overlay 6/6 PASS; Service Web 7/7 PASS; baseline 26 PASS / known 3 FAIL (no increase); `git diff --check` PASS.
- CDP Browser Gate: 35/35 PASS across home, services, company, works, and contact at 320, 390, 650, 651, 768, 1024, and 1440 CSS px. It confirmed exact viewport widths, no horizontal overflow or broken image, zero Console/Page/Resource errors, required anchors, mobile menu open/close, slider and gallery behavior, eight visible client logos, and common-footer rendering. The local contact check substitutes Cloudflare's documented always-pass test key only in the test server; it never submits the form.
- Full-page and focused 390/1440 evidence is under `docs/evidence/issue-81-browser/`; the machine-readable result is `browser-gate-v4.json`.

## GCERTI standalone mark resolution (2026-11-26)

- Content HEAD: `eb58f9c75b2ec9f0e4560903bffd81af1b56f030`.
- Management supplied the formal standalone Web PNG from `001_管理/003_logo・電子印/ISMSロゴ/ISMSロゴ.png`. Source and repository render are byte-identical: SHA-256 `89725ad37e6ada14766b8b0f8beb31061292832d066ecbccaa6047d4bb383678`, 945 x 630 px, 32-bit ARGB.
- The approved existing path `public/images/isms-gcerti-gijp-1167-ic.png` now contains only the GCERTI mark, certificate number `GIJP-1167-IC`, and standard `ISO/IEC 27001:2022`. IAS / `MSCB-113` and IAF marks are absent. No crop, recoloring, shape change, or aspect-ratio change was performed.
- Company certification information and all five common footers use the intrinsic 945 x 630 dimensions while CSS maintains a displayed width above GCERTI's 12 mm minimum. Public text remains limited to the certification name and certificate number.
- This resolves the ISMS-logo STOP item. The Overlay allowlist remains path-specific and is not broadened.
- Company information and all common footers publish the official logo, certification name, and certificate number. Scope, certified office, validity-period, and expiry text were removed.
- Management confirmed this is an existing-certification renewal and that the official logo remains unchanged.
- The contract requires the logo, certification name, and certificate number, and explicitly rejects the removed scope, office, and date metadata.
- Overlay allowlist remains the same eight paths; only `headCommit` changed for the new approved Content HEAD.
- Final verification against this Content HEAD: Build PASS; Renewal 8 PASS / 0 FAIL; Production Overlay 6 PASS / 0 FAIL; Service Web 7 PASS / 0 FAIL; established baseline remains 26 PASS / 3 known FAIL (no increase); CDP Browser Gate 35 / 35 PASS at 320, 390, 650, 651, 768, 1024, and 1440 CSS px; `git diff --check` PASS.

## R3 reviewed layout corrections (2026-11-26)

- Content HEAD: `90133a3afde01ac8e083ed6440c8b3f8ce837cb7`.
- Applied the Owner-supplied `pr82_r3_apply.py` only after its clean-worktree, exact-HEAD `--check` returned `CHECK PASS`. The script remained outside the repository.
- Editorial section headings are no longer semantic site headers, preventing the shared sticky-header CSS/JavaScript from affecting them. The two KAIZEN feature headings use controlled phrase wrapping without changing approved copy.
- The IT-management service-cycle diagram is now a non-interactive four-stage timeline rather than button-like stacked boxes. The diagram contains no anchor, button, button role, or tabindex.
- Service-page top-level sections now reset the shared section margin, use deliberate compact padding, and expose section boundaries through the approved white, pale-green, beige, and blue-gray backgrounds/borders.
- Final automated verification: Build PASS; Corporate Renewal 9/9 PASS; Production Overlay 6/6 PASS; Service Web 7/7 PASS; baseline 26 PASS / 3 known FAIL (no increase); `git diff --check` PASS.
- Final CDP Browser Gate: 40/40 PASS across home, services, company, works, and contact at 320, 390, 650, 651, 768, 1024, 1440, and 1920 CSS px. The new geometry Gate reported no heading containment/overlap, service photo/copy overlap, section-boundary gap/overlap, or interactive diagram regression. Console/Page/Resource errors, broken images, and horizontal overflow were zero.
- Full-page evidence at 390/1440/1920 and R3 focused home/services evidence are under `docs/evidence/issue-81-browser/`; machine-readable geometry and browser results are in `browser-gate-v4.json`.

## R4 SEO/AIO and note quality package v2 (2026-11-26)

- Content HEAD: `5b7656c0a13114a8da19809d2c25cf7b942eaf1b`.
- Package SHA-256: `15ef80ce7ef604102c4d3b83dc076e17fa99403638e4f47f6fcc3a4dddf46d`. The package remained outside the repository; its exact-HEAD, clean-worktree `--check` and apply both returned PASS.
- Applied the supplied metadata, structured-data, descriptive-link, three-photo lazy-loading, footer note-link, and original inline-SVG note-banner changes. `llms.txt` was not changed. No telephone, price, GA4, GTM, or Clarity addition was made.
- Build PASS; Corporate Renewal 9/9 PASS; R4 quality contract 4/4 PASS; Production Overlay 6/6 PASS; Service Web 7/7 PASS; baseline 26 PASS / 3 established FAIL (no increase); `git diff --check` PASS.
- CDP Browser Gate: 40/40 PASS across five pages at 320, 390, 650, 651, 768, 1024, 1440, and 1920 CSS px. It verifies geometry, no overflow, all non-slider images after forced lazy-load completion, slider and gallery operation, mobile menu, note visibility and URL, Klee One loading, R4 home-only placement, and zero Console/Page/Resource errors.
- Keyboard accessibility is contract-tested by the note link's native anchor semantics and explicit `:focus-visible` rule.
- Current-public HTTP baseline: 135 PASS / 1 FAIL / 18 INFO. The only FAIL is the pre-existing `http://www.atlib.jp/` redirect target `https://www.atlib.jp:443/`; R4 made no Production change. Evidence: `docs/evidence/issue-81-r4/baseline-http.json`.
- Lighthouse baseline is UNMEASURED because no Lighthouse CLI is installed. Per the supplied README, no package was installed.
- Updated full-page evidence at 390/1440/1920 is under `docs/evidence/issue-81-browser/`; the machine-readable final result is `browser-gate-v4.json`.
