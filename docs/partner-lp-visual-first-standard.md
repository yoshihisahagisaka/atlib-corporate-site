# Partner LP Visual-First Standard

Status: Canonical
Established: 2026-09-21
Applies to: InfraVision partner LP and subsequent partner-recruitment LPs, including the small-scale development LP.

## Decision

Partner-recruitment LPs use a **Visual-first** production model.

> 見せるものは画像。読ませる必要がある情報はHTML。操作するものはHTML。検索・AIに理解させる情報もHTML。

The primary visual experience may be approximately 90% designed creative imagery. HTML is not required to reproduce the visual design when doing so weakens the advertising/creative quality.

## Purpose

These LPs are primarily destinations for outbound partner acquisition (e.g. form-based outreach), not editorial SEO media. The first priority is conversion:
1. stop attention,
2. create self-relevance,
3. communicate the missed business opportunity,
4. explain the partnership value,
5. build trust,
6. move the visitor to consultation.

SEO/AIO remains required, but it supports rather than dictates the visual design.

## Production rules

### Visual layer
Use finished creative images for sections where visual impact is more important than native web layout. Pricing comparisons may also be presented visually as images when that produces a stronger creative.

Images may contain Japanese copy when the final rendered text has been checked for accuracy and legibility. Do not publish AI-invented testimonials, metrics, logos, product claims, prices, or UI states.

### HTML layer
Keep HTML for:
- page title, headings and concise visible summaries needed to understand each section,
- CTA buttons and navigation,
- forms and TimeRex,
- FAQ,
- important factual data that should remain machine-readable, especially service names, prices, plan scope and partner revenue,
- accessibility text,
- analytics/measurement,
- structured data and other SEO/AIO metadata.

Do not use search-engine-only hidden keyword text. Machine-readable copy must be legitimate page content or metadata and must accurately match the visible creative.

### Responsive implementation
Do not simply shrink desktop creatives until Japanese text becomes unreadable. Use desktop/mobile variants where necessary via picture/source, or restructure the section for mobile.

### Performance
Optimize production images (WebP/AVIF where practical), specify dimensions, lazy-load below-the-fold assets, and preserve a fast first view.

## Standard workflow

1. Fix the sales story and section order.
2. Fix art direction for the entire LP.
3. Define all production assets and filenames before generating them.
4. Generate only assets that will actually be used in production.
5. Verify every image's wording, claims, numbers and brand treatment.
6. Add the approved assets to the repository.
7. Build a thin HTML functional/semantic layer around the visuals.
8. Create mobile variants where needed.
9. Optimize images and implement analytics, accessibility, SEO/AIO and structured data.
10. Review the whole page once, then tune spacing/visual rhythm.

Avoid the failed loop: HTML card redesign -> weak visual result -> more CSS -> concept image -> back to HTML cards.

## InfraVision application

Visual creative is the main presentation method for:
- first view / hero,
- problem and missed-opportunity story,
- “気づく仕組み” transition,
- partnership model,
- plan/pricing presentation,
- partner revenue and dashboard story,
- use cases,
- reasons to partner / support model,
- onboarding flow,
- final message.

HTML remains especially important for:
- CTA,
- exact plan prices and scope (even if also shown in a visual),
- exact partner revenue figures (even if also shown in a visual),
- FAQ,
- application form,
- TimeRex,
- SEO/AIO summaries and structured data.

## Reuse for small-scale development LP

Reuse this production architecture. Change the sales story from InfraVision's “売切り -> 継続収益” to the small-development opportunity:
“顧客から相談される -> 自社では対応できず断る -> atLIBと組む -> 顧客関係を維持したまま案件化する”.

Do not repeat the InfraVision experimentation phase; start from this Visual-first standard.
