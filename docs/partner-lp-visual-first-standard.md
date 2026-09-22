# Partner LP Visual-First Standard

Status: Canonical
Established: 2026-09-21
Revised: 2026-09-22
Applies to: InfraVision partner LP and subsequent partner-recruitment LPs, including the small-scale development LP.

## Decision

Partner-recruitment LPs use a **Web-layout + Visual-assets** production model.

> LPそのものはWebとして設計する。画像は「完成した16:9ページ」ではなく、Webの視覚表現を強くする素材として使う。

The LP is one continuous vertical sales story, not a stack of presentation slides. HTML/CSS controls copy, interaction, responsive behavior, SEO/AIO and exact facts. Generated/original visual assets create advertising-level impact and explain concepts that become weak when drawn as ordinary HTML cards.

## Purpose and sales flow

These LPs are destinations for outbound partner acquisition. The visitor is not assumed to be actively searching. The page must quickly create:
1. 自社に関係する話だ
2. 既存顧客・相談案件を取りこぼしている
3. atLIBと組めば不足機能を補える
4. 何を提供できるか分かる
5. 自社の売上・顧客提案につながる
6. 任せられそう
7. まず相談してみよう

## Canonical visual rule

> **コピーはHTML。理解はインフォグラフィック。雰囲気は画像。**

Do not make each section a self-contained flyer. Avoid repeated rounded-card/table UI that makes the LP look like a PowerPoint deck. Sections should visually flow into one another through whitespace, background transitions, overlap and rhythm.

Generated assets should normally be **content modules**, not complete sections:
- no repeated header/footer inside assets,
- no outer frame unless the content requires one,
- white/transparent background for diagrams where possible,
- borders/shadows belong to the diagram elements themselves,
- avoid 16:9 as the default; choose aspect ratio from the intended Web placement.

## First-view / hero standard

The completed InfraVision partner hero is the reference pattern for subsequent partner LPs.

### Structure
- Hero may be full-bleed / near-100vw even when body content uses a narrower reading width.
- Treat the hero as one advertising canvas, not a visible two-column card.
- **Left side:** HTML service logo/brand asset, tagline, headline, supporting copy, benefits and CTA.
- **Right/background:** generated visual asset containing the business story, product/context scene and atmosphere.
- The right visual may extend behind the composition, but the left side of the asset must fade naturally to white so HTML copy has a clean reading surface.
- Do not bake the left-side headline, description, benefits or CTA into the background image.
- On mobile, reflow as native Web content; do not shrink the desktop hero as a single image.

### Hero typography
Use the available width. Do not solve balance only by widening the copy container while leaving type undersized.
- Service mark should have sufficient visual presence.
- Keep tagline close to the service mark so they read as one brand unit.
- Establish hierarchy between headline lines: the setup line may be slightly smaller; the value line is the visual lead.
- Supporting copy should remain clearly readable over the white area with no visible “text box” frame.
- Benefits should be lighter than the headline; a simple three-column treatment with separators is preferred over large repeated circles/cards when the hero already contains circular process icons.
- CTA should be prominent but should not compete with the headline.

### Hero background asset
The InfraVision reference is `infravision-partner-hero-visual-v2.png`.
- Left portion: intentionally empty white-to-scene gradient for HTML content.
- Right portion: contextual scene + product/dashboard + business-growth infographic.
- Keep critical right/top/bottom elements inside safe margins so `contain`/responsive placement does not crop them.
- Handwritten/display text inside generated assets must be visually proofread. Japanese dakuten/handakuten, punctuation and glyph count must be correct; regenerate/edit if malformed.
- The asset is not the final hero by itself. It is the visual layer beneath/alongside native HTML copy.

## Brand assets

Corporate atLIB logo must use the official supplied asset when representing the corporate identity.

A separately designed **service/program logo** may be created as its own brand asset (for example, `atLIB InfraVision PARTNER PROGRAM`). It does not have to reproduce the corporate wordmark exactly, provided it is intentionally treated as a service brand rather than a replacement corporate logo.

For reusable service branding:
- keep the service logo as a standalone transparent asset,
- keep long taglines in HTML where practical,
- prepare variants with/without program labels when future use requires them.

## Native Web content

Use HTML/CSS for:
- vertical LP composition and section rhythm,
- headings, body copy and factual statements,
- CTA/navigation,
- forms and TimeRex,
- FAQ,
- responsive reflow,
- analytics, accessibility, structured data and SEO/AIO,
- exact pricing/plan/revenue information when shown.

Exact factual content should not be trapped only inside an image. For image-led diagrams, preserve an accurate visible or accessible HTML summary/alt treatment.

## Visual assets

Use generated/original assets for:
- contextual scenes and atmosphere,
- hero background/right-side visual,
- conceptual infographics,
- collaboration/support diagrams,
- problem/opportunity visualizations.

For embedded diagrams, the preferred pattern established in InfraVision is:
- HTML section heading/copy outside the image,
- diagram only inside the image,
- white/transparent canvas,
- no image-level title/footer duplication,
- no AI-generated corporate logo,
- no unverified metrics, testimonials or guaranteed outcomes.

Do not use copyrighted Web imagery unless rights are established.

## SEO/AIO and accessibility

Important copy stays in semantic HTML where practical. Maintain:
- clear heading hierarchy,
- concise natural-language explanations,
- FAQ,
- accurate structured data,
- meaningful alt/accessibility treatment,
- no hidden search-engine-only keyword text,
- no misleading duplication between image text and hidden HTML.

## Responsive and performance

The page must reflow as a Web page. Desktop visual composition and mobile reading order can differ. Do not shrink a desktop flyer until Japanese text becomes unreadable.

Optimize production assets (WebP/AVIF where practical), specify dimensions, lazy-load below-the-fold assets, and prioritize fast hero rendering.

## Standard workflow

1. Fix the sales story and section order.
2. Fix art direction and the continuous vertical rhythm.
3. Decide the Web composition for each section.
4. Mark each element as HTML/CSS or visual asset.
5. For the hero, design the **complete visual comp first**, then separate it into native HTML copy + background/right-side asset.
6. Define asset dimensions from actual placement, not from a default 16:9 canvas.
7. Generate/source only the needed assets and visually proofread all Japanese text.
8. Save approved assets with stable filenames in the LP asset directory.
9. Integrate assets into native responsive HTML/CSS.
10. Compare the browser rendering side-by-side with the approved comp; tune container width **and** typography scale together.
11. Check desktop and mobile, then analytics, accessibility, SEO/AIO and structured data.
12. Review the whole page as one scroll story before production deployment.

## Failure modes learned from InfraVision

Do not repeat these:
- stacking 16:9-looking blocks that feel like page changes,
- widening the hero container without scaling the typography to match,
- using a background visual that also contains the same left-side copy as HTML, causing collisions,
- cropping important right/bottom visual content with aggressive cover behavior,
- adding visible white panels behind copy instead of designing the asset with a natural white gradient,
- generating full hero artwork when only the right/background layer is needed,
- repeatedly regenerating the wrong asset because “complete hero comp” and “uploadable background visual” were not distinguished,
- accepting malformed Japanese display text (especially dakuten) without visual inspection.

## InfraVision reference implementation

Reference LP:
`public/infravision-partner/index.html`

Key assets:
- `infravision-partner-logo.png` — service/program logo
- `infravision-partner-hero-visual-v2.png` — hero background/right-side visual with left white gradient
- `infravision-partner-service-flow-2.png` — service mechanism infographic
- `infravision-partner-customer-visibility-gap.png` — existing-customer opportunity visualization
- `infravision-partner-collaboration-flow.png` — partner × atLIB collaboration model
- `infravision-partner-support-system.png` — support/trust visualization

The reference hero deliberately separates **HTML copy** from the **visual layer**.

## Reuse for small-scale development LP

Reuse this architecture rather than repeating the InfraVision experimentation phase.

Change the sales story from InfraVision's:
`売切り → 継続的に見える → 気づく → 提案 → 継続収益`

to the small-scale development partner story:
`顧客から相談される → 自社では対応しづらい → atLIBと連携 → 顧客関係を維持したまま案件化 → 次の相談も受けられる`

Keep the same core production pattern:
**full-bleed visual hero + HTML sales copy + selective infographic modules + continuous vertical Web story + consultation CTA.**
