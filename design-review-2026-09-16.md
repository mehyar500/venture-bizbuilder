# BizBuilder — Design Review: Sample Pages + Fixes (2026-09-16)

## Buyer monologue
I have a business idea but no plan — I need someone to just write it.
$17 is nothing, but is this a real plan or AI filler?
Let me see a page before I pay — the offer page, the 30-day plan.
Free excerpt first — that's fair, let me judge the quality.
If the sample pages look this concrete for my idea, take my $17.

## Pass 1 issues
1. **No visual samples of the paid deliverables.** The three assets (plan, landing
   copy, emails) were described but never shown.
2. **Form inputs at 15px** — iOS auto-zoom risk and readability.
3. **Nav CTA ~38px tall** on touch — under 44px.
4. **Market-figure comparison.** Pricing compared against "Typical agency $2,000+"
   / "Typical guru course $197+" — unsupported claims, even hedged.

## Fixes applied
1. Rendered 3 SAMPLE-marked blueprint PNGs (900x1165) for a sample mobile
   dog-grooming idea — The Offer, Go-to-Market: First 30 Days, Email 1 of 5 —
   wired as a lazy-loaded gallery in `#inside` ("Sample pages from a real build")
   with dimensions, alt text, and mobile-first 1-col -> 3-col grid.
2. Field and subscribe-form inputs -> 16px.
3. Nav CTA min-height 44px (inline-flex) on coarse pointers.
4. Replaced agency/course comparison with a factual Free vs Paid comparison:
   Free excerpt ($0: concept summary, target customer, one plan section,
   3 milestones) vs Full build ($17: 8-section plan, landing copy, 5 emails,
   web doc + PDF).

## Pass 2 result
Verified in code: 3 images at 900x1165 with dims/alt/lazy; 16px inputs; tap
targets >=44px; mobile-first gallery; no market figures remain; viewport meta
present; existing refund-related copy left untouched per instruction. Note:
screenshots were unavailable by task constraint, so this was a source-code/mobile
CSS review (no browser pass).

## Verdict
SHIP — no material issue remains.
