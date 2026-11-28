# PR #82 R4 Staging performance measurement

Date: 2026-11-27 JST  
Scope: read-only measurement and analysis  
Revision: `corporate-site-staging-00040-lok`  
Image: `sha256:14d1e9030e250f80806aed84eead3828dfecd51c79fbe4822a7b1bb542892247`  
URL: `https://r4-1127010138---corporate-site-staging-y6htingfbq-an.a.run.app`

## Method and integrity

- Lighthouse 12.8.2, Node 24.18.0, the same Windows PC and installed Chrome used for the R4 baseline.
- Five pages, mobile and desktop. Three complete passes were attempted.
- No Chrome sandbox disabling, form submission, code/configuration change, Build, Deploy, or Traffic change.
- Staging `noindex` is expected. The resulting SEO 0.69 is not treated as a defect.
- Run 1 missed works mobile and run 2 missed contact mobile with Lighthouse `NO_FCP`. Run 3 completed all cases. Medians are reported for three samples; the two missing cases use the midpoint of two successful samples and are marked `n=2`.

## Results

| Page | Mobile Performance | FCP | LCP | CLS | TBT | n | Desktop Performance |
|---|---:|---:|---:|---:|---:|---:|---:|
| Home | 56 | 9.91 s | 12.38 s | 0 | 0 ms | 3 | 72 |
| Services | 56 | 10.14 s | 15.10 s | 0 | 0 ms | 3 | 72 |
| Contact | 56 | 9.69 s | 11.28 s | 0 | 0 ms | 2 | 78 |
| Company | 56 | 10.84 s | 11.48 s | 0 | 0 ms | 3 | 73 |
| Works | 56 | 10.80 s | 11.35 s | 0 | 0 ms | 2 | 72 |

The 70-point mobile target is not met. Compared with the previous Production baseline, Home, Services, and Works remain 56; Company moves from 55 to 56. A comparable successful Production contact-mobile result was not available. The Staging result therefore does not show an R4-specific mobile regression or improvement; it reproduces the common delivery bottleneck.

## LCP elements

| Page | LCP element | Dominant LCP phase |
|---|---|---|
| Home | First-view `concept.jpg` (`div.image > div.slide > picture > img`) | Render delay 82% |
| Services | Hero detail paragraph | Render delay 96% |
| Contact | Hero explanatory paragraph | Render delay 94% |
| Company | Origin-section paragraph | Render delay 95% |
| Works | Hero `h1` | Render delay 94% |

Only Home has an image LCP. The other four LCPs are text, yet they have the same mobile score. This rules out the gallery or first-view slideshow as the primary site-wide cause.

## Render-blocking resources

Common mobile findings:

- Google Fonts Noto Sans JP CSS: about 152 KB transferred; estimated blocking 1.85-2.51 s.
- Font Awesome CSS: about 19.6 KB; estimated blocking about 0.93 s, followed by regular and solid WOFF2 files (about 26 KB and 157 KB).
- `/css/style.css`: about 42 KB; estimated blocking 0.45-0.75 s.
- `/css/atlib-service-renewal.css`: about 31.9 KB; estimated blocking 0.15-0.45 s.
- `/css/atlib.css`: about 27.2 KB; estimated blocking 0.30-0.45 s.
- Home only: Klee One CSS is only 762 bytes but adds an estimated 0.81 s to the render path.
- Page-specific CSS adds a smaller 0.15 s class of delay.

The Noto Sans JP request uses five weights and expands into many WOFF2 subset requests. Total external CSS/font transfer observed by Lighthouse is approximately 0.92-1.24 MB per page (Home 1.10 MB; Services 1.11 MB; Contact 0.92 MB; Company 1.23 MB; Works 1.24 MB).

## Text compression

Lighthouse reports the same-origin text responses as uncompressed. Estimated transferable-byte savings are approximately:

- Home: 110 KB
- Services: 122 KB
- Contact: 110 KB
- Company: 115 KB
- Works: 113 KB

The largest repeated candidates are `style.css` (about 31 KB saving), `atlib-service-renewal.css` (about 26 KB), `atlib.css` (about 21 KB), page HTML (about 8-18 KB), and `main.js` (about 13 KB). Enabling Brotli or gzip at the serving layer is the lowest-design-risk, site-wide first candidate.

## Images

Home's largest transfers include:

- `business-web/assets/gyomu-kaizen-logo.png`: 417 KB, displayed about 352 x 117 CSS px; responsive-size saving estimate 384 KB.
- `images/brand/it-management-kaizen-logo-v1.png`: 393 KB.
- `images/partner_logo_mixi.png`: 138 KB; responsive-size saving estimate 138 KB.
- `images/brand/atlib-logo.png`: 105 KB; responsive-size saving estimate 103 KB in footer use.
- `images/concept.jpg`: 75 KB; LCP image, displayed about 412 x 310 CSS px; estimated size saving 32 KB.
- `images/mainimg2.jpg`: 55 KB; estimated size saving 46 KB in the service feature.
- Mobile slideshow `mainimg2_s.jpg` and `mainimg3_s.jpg`: 42 KB and 35 KB.

Official logos, service diagrams, company information, the service system, and note banner are retention requirements. Optimization should therefore use approved, aspect-preserving responsive derivatives and formats rather than removing or visually altering those assets.

Contact, Company, and Works transfer only the common atLIB logo (about 105 KB) and ISMS mark (about 21 KB), but still score 56. Image optimization alone will not reach 70.

## Minimum improvement order for a later implementation gate

1. Enable Brotli/gzip for same-origin HTML, CSS, and JavaScript. This is global, avoids design changes, and addresses roughly 110-122 KB of repeated waste per page.
2. Shorten the critical render path: reduce Noto Sans JP weights/subset requests, load noncritical fonts/CSS without blocking first paint, and scope Font Awesome to actually used icons or equivalent existing SVGs.
3. Keep the Home LCP image discoverable and high priority; provide a correctly sized mobile derivative without changing the approved photograph.
4. Provide approved responsive derivatives for the two KAIZEN logos, MIXI, atLIB footer logo, and ISMS mark. Preserve official color, shape, aspect ratio, and required minimum size.
5. Consider Home-only reductions after the common fixes: a static first view can avoid the two noninitial mobile-slide transfers (about 77 KB), and removing the photo gallery can reduce below-the-fold requests. These changes cannot explain or fix the four text-LCP pages and should not be the first action.
6. Re-measure three times on the same tagged Revision and compare medians. Do not use Staging SEO as a release gate while `noindex` is active.

## Evidence

- `docs/evidence/issue-81-r4/lighthouse-staging-00040-run{1,2,3}/summary.json`
- `docs/evidence/issue-81-r4/lighthouse-staging-00040-analysis.json`

Raw Lighthouse reports were used for the detailed resource analysis but are not retained in Git; the summaries and consolidated analysis contain the measurement values, failure records, URLs, transfer sizes, estimated savings, and LCP elements needed for review.
