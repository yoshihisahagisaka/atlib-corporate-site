# Partner LP Visual-First Standard

Status: Canonical
Established: 2026-09-21
Revised: 2026-09-22
Applies to: InfraVision partner LP and subsequent partner-recruitment LPs, including the small-scale development LP.

## Decision

Partner-recruitment LPs use a **Web-layout + Visual-assets** production model.

> LPそのものはWebとして設計する。画像は「完成した16:9ページ」ではなく、Webの視覚表現を強くする素材として使う。

The objective is not to paste a sequence of 16:9 flyer images into a page. The page remains a responsive vertical web experience. Photography, illustration, background art and other visual assets provide advertising-level impact; HTML/CSS controls layout, copy, facts, responsive behavior and interaction.

## Purpose

These LPs are primarily destinations for outbound partner acquisition (e.g. form-based outreach). Conversion is the first priority: stop attention, create self-relevance, communicate the missed opportunity, explain partnership value, build trust, and move the visitor to consultation. SEO/AIO remains required but does not dictate the visual design.

## Production rules

### Web layout
Use HTML/CSS for:
- the vertical LP composition and section rhythm,
- headings, body copy and factual statements,
- pricing, plan scope and partner revenue,
- diagrams when they need exact labels or values,
- CTA buttons/navigation,
- forms and TimeRex,
- FAQ,
- responsive reflow,
- analytics, accessibility, structured data and SEO/AIO metadata.

Pricing can be highly designed, but the exact prices remain HTML rather than a fixed 16:9 pricing image.

### Visual assets
Generate or source only assets that are actually placed in the Web layout, such as:
- business photography / people,
- contextual scenes,
- background visuals,
- decorative graphics,
- illustrations that do not depend on exact factual text.

Do not generate a complete LP section as a 16:9 flyer merely to paste it into the page. Do not publish AI-generated logos, invented dashboard metrics, testimonials, prices, product claims or UI states. Official atLIB logo assets must be used directly.

### SEO/AIO
Do not use search-engine-only hidden keyword text. Important machine-readable content must be legitimate visible content or accurate metadata. Keep clear heading hierarchy, concise natural-language explanations, FAQ and structured data.

### Responsive implementation
The layout must reflow as a Web page. Do not solve mobile by shrinking a desktop flyer until Japanese text is unreadable. Images may use alternate crops/assets where needed.

### Performance
Optimize production assets (WebP/AVIF where practical), specify dimensions, lazy-load below-the-fold assets, and preserve a fast first view.

## Standard workflow

1. Fix the sales story and section order.
2. Fix art direction.
3. Design the Web composition for every section.
4. Mark each element as HTML/CSS or visual asset.
5. Define only the visual assets actually needed, with filenames and intended placement.
6. Generate/source those assets.
7. User saves approved binary assets to the specified repository asset path when necessary.
8. Implement the Web layout and integrate assets.
9. Implement mobile behavior, analytics, accessibility, SEO/AIO and structured data.
10. Review the whole page and tune visual rhythm.

Avoid both failed extremes:
- repetitive HTML card design with insufficient visual impact;
- generating complete 16:9 flyer images and treating them as the LP.

## InfraVision application

Current hero asset `hero-partnership.png` remains a valid example: it is a visual asset inside a Web hero, not the whole hero section.

The rest of the LP should use Web layouts with selective visual assets for problem/opportunity, partnership, use cases/support and final emotional emphasis. Plans/pricing, partner revenue, dashboard facts, onboarding steps, CTA, FAQ, form and TimeRex remain native Web content.

## Reuse for small-scale development LP

Reuse this architecture. Change the sales story from InfraVision's “売切り -> 継続収益” to:
“顧客から相談される -> 自社では対応できず断る -> atLIBと組む -> 顧客関係を維持したまま案件化する”.

Do not repeat the InfraVision experimentation phase; start from this standard.
