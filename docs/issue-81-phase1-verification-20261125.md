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
- Published facts: ISO/IEC 27001:2022; certificate GIJP-1167-IC; scope `ITコンサルティング事業・IT支援事業`; certified office `東京都中央区八丁堀4-12-7 明豊パークタワービル3階`; validity `2026年12月1日〜2029年11月30日`.
- The ISMS logo is present in company information and the common footer. CSS keeps its displayed width above the 12 mm Web minimum at PC and mobile widths.
- Overlay protection remains fail-closed for `public/images`; only the two named official logo assets are explicit exceptions. The candidate Dockerfile has one COPY per allowlisted path.
- Final CDP Browser Gate: 21/21 PASS across home, services, and company at 320, 390, 650, 651, 768, 1024, and 1440 CSS px. No broken image, horizontal overflow, Console/Page/Resource error, or anchor regression. MIXI decoded at 6000x3614; every ISMS rendering was visible at no less than the 12 mm Web minimum.
- Updated full-page evidence: `docs/evidence/issue-81-browser/{home,services,company}-v4-{390,1440}-full.png`; company ISMS detail: `company-v4-feature-{390,1440}.png`; machine-readable result: `browser-gate-v4.json`.
- Final checks: `npm ci` PASS; Build PASS; Renewal 7 PASS / 0 FAIL; Production Overlay 6 PASS / 0 FAIL; Service Web 7 PASS / 0 FAIL; established baseline 26 PASS / 3 known FAIL (no increase); `git diff --check` PASS.
