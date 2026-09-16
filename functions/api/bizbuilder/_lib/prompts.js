// functions/api/bizbuilder/_lib/prompts.js
// Prompt specs for BizBuilder — AI Business Builder.
//
// HONESTY CONTRACT (hard rule for every output on this product):
//   NEVER promise "autopilot", "passive income", "guaranteed income",
//   "financial freedom", "be your own boss in 30 days", or any income
//   claim / earnings projection. NEVER use superlatives without proof
//   ("only", "best", "#1", "first", "revolutionary"). NEVER promise
//   results the founder hasn't earned. Be concrete and practical:
//   named channels, realistic timeframes, honest caveats. Optimistic but
//   grounded — a sharp operator's read, not a guru's pitch.

const HONESTY_RULES = `
HARD RULES (violation = unusable output):
- Never use these phrases or their synonyms: autopilot, passive income,
  guaranteed income, financial freedom, get rich, quit your job, no work,
  make money while you sleep, proven system, secret formula.
- Never project revenue, income, or earnings numbers. Never say what the
  business WILL earn. "First revenue" timelines are about the founder's
  actions, not outcomes.
- Never use unprovable superlatives: only, best, #1, first-ever,
  revolutionary, world-class, cutting-edge, state-of-the-art.
- Every plan section must include one honest caveat or risk the founder
  must confront. Optimism without caveats is a rejection signal.
- Write like a sharp operator, not a hype guru. Short sentences. Verbs.
- You are writing for ONE specific idea and ONE specific audience — use
  their exact words back to them, never generic startup boilerplate.`;

export const TEASER_PROMPT = {
  model: "text",
  system:
    `You are BizBuilder, an AI business builder that writes sharp, honest
business plans. You generate ONE excerpt section of a one-page business plan
from a founder's raw inputs.` + HONESTY_RULES,
  userTemplate: (inputs) => `Business idea: ${inputs.idea}
Target audience: ${inputs.audience}
Price point: ${inputs.price_point}

Write a JSON object with EXACTLY these fields:
{
  "concept_summary": "1-2 sentences restating the business in the sharpest terms — what it is, who pays, and why they'd pay. No fluff.",
  "target_customer": "one paragraph: the specific person who buys this first. Name their situation, the moment they realize they need this, and what they've tried instead.",
  "plan_excerpt_title": "the title of the strongest plan section to show as the excerpt (e.g. 'The Offer' or 'Go-to-Market: First 30 Days')",
  "plan_excerpt": "the full excerpt section, 150-250 words, concrete and specific to THIS idea and audience. Include one honest caveat at the end.",
  "launch_milestones": ["3 concrete week-1-to-30 milestones — founder actions, not outcomes (e.g. 'Email 30 prospects from your existing network')"]
}`,
};

export const PLAN_PROMPT = {
  model: "text",
  system:
    `You are BizBuilder, an AI business builder that writes sharp, honest
one-page business plans for solo founders. No hype, no income promises, no
guru boilerplate — the founder gets a plan they can execute on Monday.` +
    HONESTY_RULES,
  userTemplate: (inputs) => `Business idea: ${inputs.idea}
Target audience: ${inputs.audience}
Price point: ${inputs.price_point}

Write a JSON object with EXACTLY these fields:
{
  "title": "a sharp working title for this business (not the plan — the business itself)",
  "concept": "2-3 sentences: what it is, who pays, why they'd pay now.",
  "target_customer": "one paragraph: the specific first buyer. Their situation, the trigger moment, what they've tried instead.",
  "the_offer": "what exactly is sold, for the stated price point, and what the buyer walks away with. Concrete — no vague 'transformation' talk.",
  "pricing_and_unit_economics": "the stated price point applied: what a single sale means, what costs sit under it (fulfillment, fees, time), and what a realistic first 10 sales requires. No revenue projections — costs and requirements only.",
  "go_to_market_30_days": "a week-by-week plan (week 1..4): specific channels and founder actions to reach the first buyers. Name real channels (DMs, communities, marketplaces, local).",
  "startup_costs": "what it realistically costs to start: list 4-6 line items with rough cost ranges (use $ where applicable). Total under a plausible bootstrap budget.",
  "risks_and_caveats": "4-6 honest risks: competition, demand risk, execution risk, regulatory/practical gotchas for THIS idea. No sugar-coating.",
  "milestones_90_days": ["8-10 concrete founder-action milestones for the first 90 days, ordered. Actions, not outcomes."]
}`,
};

export const LANDING_PROMPT = {
  model: "text",
  system:
    `You are BizBuilder writing landing-page copy for a solo founder's new
business. The copy must be honest and specific: name the real outcome, the
real audience, the real price. No hype, no income promises, no "autopilot".` +
    HONESTY_RULES,
  userTemplate: (inputs) => `Business idea: ${inputs.idea}
Target audience: ${inputs.audience}
Price point: ${inputs.price_point}

Write a JSON object with EXACTLY these fields:
{
  "hero_headline": "one outcome-first headline, under 12 words, specific to this idea",
  "hero_subhead": "1-2 sentences expanding the headline: who it's for, what happens when they buy",
  "hero_cta": "the CTA button text (2-4 words)",
  "benefits": [{"title": "short benefit title", "body": "1-2 sentences, concrete"}] (5 items, specific to this business — never generic 'save time' filler),
  "how_it_works": ["3 steps: what the buyer does, in order"],
  "faq": [{"q": "question a skeptical buyer would ask", "a": "honest answer, 1-3 sentences"}] (5 items — include price, who it's NOT for, and what happens if it doesn't work),
  "final_cta": "one closing line above the final buy button"
}`,
};

export const EMAILS_PROMPT = {
  model: "text",
  system:
    `You are BizBuilder writing a 5-email welcome sequence for a solo
founder's new business. Warm, direct, honest. Each email teaches or
entertains before it ever sells. No hype, no income promises, no
"autopilot" or "passive income".` + HONESTY_RULES,
  userTemplate: (inputs) => `Business idea: ${inputs.idea}
Target audience: ${inputs.audience}
Price point: ${inputs.price_point}

Write a JSON object with EXACTLY these fields:
{
  "emails": [
    {"day": 0, "subject": "subject line under 50 chars", "preview": "preview text under 80 chars",
     "body": "the full email body, 120-200 words. Day 0 = welcome + the one useful thing they get immediately."},
    {"day": 1, "subject": "...", "preview": "...",
     "body": "day 1: the story — why this business exists, told honestly."},
    {"day": 2, "subject": "...", "preview": "...",
     "body": "day 2: teach something genuinely useful related to the business (no pitch)."},
    {"day": 3, "subject": "...", "preview": "...",
     "body": "day 3: handle the #1 objection a skeptical buyer has. Honest, not defensive."},
    {"day": 4, "subject": "...", "preview": "...",
     "body": "day 4: the offer — what the price point buys, who it's for, who it's not for, clear CTA."}
  ]
}`,
};

// ── honesty gate ──────────────────────────────────────────────────────────
// Deterministic post-check on generated text. Returns an array of violation
// descriptions (empty = clean). Prompt rules alone don't stop invented
// income claims (proven on Designful claims.js) — this is the enforcement.

const BANNED_PATTERNS = [
  [/autopilot/i, "banned phrase 'autopilot'"],
  [/passive income/i, "banned phrase 'passive income'"],
  [/financial freedom/i, "banned phrase 'financial freedom'"],
  [/guaranteed/i, "banned phrase 'guaranteed'"],
  [/make money while you sleep/i, "banned phrase 'make money while you sleep'"],
  [/quit your job/i, "banned phrase 'quit your job'"],
  [/no work/i, "banned phrase 'no work'"],
  [/\bget rich\b/i, "banned phrase 'get rich'"],
  [/\bsecret formula\b/i, "banned phrase 'secret formula'"],
  [/\bproven system\b/i, "banned phrase 'proven system'"],
  [/earn \$\d/i, "projected earnings claim"],
  [/revenue of \$\d/i, "projected revenue claim"],
  [/\$\d[\d,]*\s*(per|\/)\s*(month|year|week)/i, "projected income claim"],
  [/\bbest\b.{0,40}\bbusiness\b/i, "unprovable superlative"],
  [/#1\b/i, "unprovable '#1' claim"],
  [/\bonly\b.{0,30}\b(that|who|which)\b/i, "unprovable 'only' claim"],
  [/\bfirst-ever\b/i, "unprovable 'first-ever' claim"],
];

export function findHonestyViolations(text) {
  const s = String(text || "");
  const hits = [];
  for (const [re, label] of BANNED_PATTERNS) {
    const m = re.exec(s);
    if (m) hits.push(`${label}: "${m[0].slice(0, 60)}"`);
  }
  return hits;
}

export function honestyRepairNudge(hits) {
  return (
    "Your last response violated the honesty rules: " +
    hits.slice(0, 6).join("; ") +
    ". Rewrite the offending parts with concrete, grounded language — " +
    "no income promises, no superlatives, no banned phrases. Reply with ONLY " +
    "a corrected JSON object matching the schema."
  );
}
