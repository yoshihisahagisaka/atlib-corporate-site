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
