# PR #82 R5-B Staging mobile performance measurement

Date: 2026-11-27 JST
Scope: read-only measurement and analysis
Content HEAD: `fa39da1fe04a583411591ef8034386f2411e53ee`
Control HEAD at measurement start: `7f5adcdf24cb170a9a77e73041fab07d935b4786`
Revision: `corporate-site-staging-00041-pow`
Image: `sha256:d15a905ad2a2f44d864e6e0ebe99b528d3006e444ddfced19ce995435be812f4`
URL: `https://r5b-1127034348---corporate-site-staging-y6htingfbq-an.a.run.app`

## Integrity and method

- Read-back confirmed the Revision is Ready and uses the expected immutable digest. Existing Staging traffic remains `corporate-site-staging-00031-kot = 100%`; the R5-B tagged Revision remains 0%.
- Lighthouse 12.8.2, Node 24.18.0, the same Windows PC and installed Chrome family used for the R4 measurement.
- Five pages, mobile only, three valid measurements per page. The median of each metric is used below.
- Staging `noindex` is expected and is not treated as a defect. The direct tagged URL does not traverse the Production Cloud CDN, so the separately enabled Brotli/gzip benefit is not included.
- No form POST, Build, Scan, Deploy, traffic, GCP configuration, application code, or merge operation was performed.

## Result

| Page | Runs | Performance median | R4 median | Delta | FCP | LCP | CLS | TBT | LCP render delay | Total transfer |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Home | 77 / 76 / 76 | **76** | 56 | +20 | 2.51 s | 5.58 s | 0 | 0 ms | 405 ms | 1,786 KiB |
| Services | 75 / 75 / 75 | **75** | 56 | +19 | 1.68 s | 7.97 s | 0 | 0 ms | 607 ms | 1,265 KiB |
| Contact | 78 / 86 / 78 | **78** | 56 | +22 | 2.24 s | 5.29 s | 0 | 0 ms | 291 ms | 705 KiB |
| Company | 87 / 87 / 87 | **87** | 56 | +31 | 1.67 s | 3.92 s | 0 | 0 ms | 360 ms | 465 KiB |
| Works | 87 / 87 / 87 | **87** | 56 | +31 | 1.61 s | 3.93 s | 0 | 32 ms | 469 ms | 462 KiB |

All five pages meet the mobile Performance median target of 70. Under the approved decision rule, no additional performance implementation is required.

## LCP targets

| Page | LCP element |
|---|---|
| Home | Hero description paragraph (`p.hero-description`) |
| Services | Hero detail paragraph (`p.svc-hero-detail`) |
| Contact | Contact hero explanatory paragraph |
| Company | Origin-section paragraph |
| Works | Hero `h1` |

All measured LCP targets are text. The Home first-view image is no longer the LCP target in these three R5-B runs.

## Fonts and render path

- Noto Sans JP font-body transfer: **0 bytes on every page and run**.
- Manrope font-body transfer: **0 bytes on every page and run**.
- Font Awesome external transfer: **0 bytes on every page and run**.
- Home retains only the approved Klee One subset font body: median about 2.8 KiB. Other pages transfer no external font body.
- Google Fonts CSS is still discovered at about 150 KiB per page, but the mobile-inapplicable Noto Sans JP and Manrope font bodies are not downloaded and their CSS is not reported as a mobile render blocker.
- The remaining common blocking resources are `corporate-r5-base.css` (about 52.5 KiB), `atlib-service-renewal.css` (about 31.9 KiB), `atlib.css` (about 27.2 KiB), and each page-specific CSS. Home also retains Klee One CSS (762 bytes, median estimated blocking 806 ms).

## R4 comparison and residual Fit/Gap

- R4 mobile medians were 56 on all five pages. R5-B improves the median by 19 to 31 points and reduces FCP from roughly 9.7-10.8 s to 1.6-2.5 s.
- LCP improves from roughly 11.3-15.1 s to 3.9-8.0 s. Services remains the slowest LCP at 7.97 s, but its Performance median is 75 and therefore passes the approved target.
- R4's Noto Sans JP and Font Awesome font-body transfers are removed on mobile. There is no R5-B regression in CLS; TBT remains effectively zero apart from a 32 ms Works median.
- The Staging direct URL reports same-origin resources without the Production CDN's separately verified Brotli/gzip delivery. Production delivery should therefore be equal or better for compressible HTML/CSS/JavaScript, but that is an inference and not counted in this Staging score.
- No release blocker remains in this Performance Gate. Lighthouse is a lab measurement, not field Core Web Vitals.

## Home optional reductions

Additional Home reductions are not required because the median is 76.

- Static first view could avoid the two noninitial mobile slide transfers (`mainimg2_s.jpg` and `mainimg3_s.jpg`), about 77 KiB combined, but would remove the approved slider behavior.
- Removing the photo gallery could avoid about 128 KiB of unique gallery-only transfers (`landscape1.jpg`, `strengths2.jpg`, and `mainimg2.jpg`). `concept.jpg` is reused outside the gallery and would remain.
- These changes affect approved presentation and cannot address the Services text-LCP bottleneck. They should not proceed without a separate design decision.

## Evidence

- `docs/evidence/issue-81-r5b/lighthouse-staging-00041-summary.json`
- `docs/evidence/issue-81-r5b/lighthouse-staging-00041-analysis.json`

The raw 15 Lighthouse reports remain in a repository-external temporary directory and are not committed. The checked-in analysis retains all samples, medians, LCP nodes, render-delay values, render-blocking resource URLs/sizes/savings, font-transfer classification, and total transfer values needed for review.
