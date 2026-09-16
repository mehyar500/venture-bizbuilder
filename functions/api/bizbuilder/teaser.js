// functions/api/bizbuilder/teaser.js
// POST /api/bizbuilder/teaser — free teaser: a real sample business plan
// excerpt generated from the founder's own inputs.
// Body: { idea: "1-2 sentences", audience: "...", price_point: "..." }
// Returns: { concept_summary, target_customer, plan_excerpt_title,
//            plan_excerpt, launch_milestones } + upgrade note.
//
// Teasers are free/unauthenticated → KV-backed per-IP hourly cap
// (fail-open without the KV binding). Inputs sanitized + length-capped.

import { runText, runTextJson, parseJson, MODELS } from "./_lib/ai.js";
import { cleanText } from "./_lib/inputs.js";
import {
  TEASER_PROMPT,
  findHonestyViolations,
  honestyRepairNudge,
} from "./_lib/prompts.js";

const RL_CAP = 20; // teasers per IP per hour
const RL_WINDOW_S = 3600;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function checkRateLimit(env, request) {
  if (!env.BIZBUILDER_KV) return { ok: true };
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for") ||
    "unknown";
  const key = "rl:teaser:" + ip;
  try {
    const cur = Number((await env.BIZBUILDER_KV.get(key)) || 0);
    if (cur >= RL_CAP) return { ok: false };
    await env.BIZBUILDER_KV.put(key, String(cur + 1), { expirationTtl: RL_WINDOW_S });
    return { ok: true };
  } catch {
    return { ok: true }; // fail open — never break the funnel on KV hiccups
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const rl = await checkRateLimit(env, request);
    if (!rl.ok) return json({ ok: false, error: "rate_limited" }, 429);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "bad_json" }, 400);
    }
    const idea = cleanText(body && body.idea, 600);
    const audience = cleanText(body && body.audience, 300);
    const price_point = cleanText(body && body.price_point, 120);
    if (!idea) return json({ ok: false, error: "missing_input", input: "idea" }, 400);
    if (!audience) return json({ ok: false, error: "missing_input", input: "audience" }, 400);
    if (!price_point) return json({ ok: false, error: "missing_input", input: "price_point" }, 400);

    const spec = TEASER_PROMPT;
    const messages = [
      { role: "system", content: spec.system },
      { role: "user", content: spec.userTemplate({ idea, audience, price_point }) },
    ];
    const { parsed } = await runTextJson(env, MODELS[spec.model], messages, {
      max_tokens: 1800,
      temperature: 0.7,
      retries: 2,
      label: "bizbuilder-teaser",
      validate: (d) => {
        if (!d || typeof d.concept_summary !== "string" || typeof d.plan_excerpt !== "string") return false;
        const hits = findHonestyViolations(
          [d.concept_summary, d.target_customer, d.plan_excerpt, (d.launch_milestones || []).join(" ")].join(" ")
        );
        if (hits.length) return honestyRepairNudge(hits);
        return true;
      },
    });

    return json({
      ok: true,
      teaser: {
        concept_summary: String(parsed.concept_summary).slice(0, 500),
        target_customer: String(parsed.target_customer || "").slice(0, 800),
        plan_excerpt_title: String(parsed.plan_excerpt_title || "Plan excerpt").slice(0, 120),
        plan_excerpt: String(parsed.plan_excerpt).slice(0, 2000),
        launch_milestones: (parsed.launch_milestones || []).slice(0, 3).map((m) => String(m).slice(0, 200)),
      },
      preview: {
        tier: "free",
        upgrade:
          "This is one excerpt. The $17 full build ships the complete one-page business plan (all 8 sections), the full landing-page copy (hero, benefits, FAQ), and a 5-email welcome sequence — as a styled web doc + PDF.",
      },
    });
  } catch (e) {
    console.error("bizbuilder/teaser failed", e && e.message);
    return json({ ok: false, error: "teaser_failed" }, 500);
  }
}
