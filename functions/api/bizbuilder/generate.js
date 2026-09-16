// functions/api/bizbuilder/generate.js
// POST /api/bizbuilder/generate — build the FULL paid BizBuilder deliverable.
// Body: { order_token: "<bizbuilder_orders.access_token>", inputs: {...} }
//   inputs merge over the intake inputs stored at checkout.
//
// Auth: the order's access_token is the capability. Single SKU — the token
// owns its own order. Re-requesting a ready order returns the stored manifest
// instead of burning AI budget again (idempotent generate).
//
// The manifest (stored in bizbuilder_orders.output_json) contains the three
// text deliverables inline: business plan (HTML doc), landing copy
// (markdown), 5-email sequence (markdown), plus the raw JSON. The PDF is
// built on demand by /api/bizbuilder/pdf?token= (token-gated).

import { runTextJson, boundedMap, MODELS } from "./_lib/ai.js";
import { cleanText } from "./_lib/inputs.js";
import {
  PLAN_PROMPT,
  LANDING_PROMPT,
  EMAILS_PROMPT,
  findHonestyViolations,
  honestyRepairNudge,
} from "./_lib/prompts.js";

const nowSql = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function para(s) {
  return "<p>" + esc(s).replace(/\n\n+/g, "</p><p>") + "</p>";
}

function list(items) {
  return "<ul>" + items.map((i) => "<li>" + esc(i) + "</li>").join("") + "</ul>";
}

// Deterministic honesty gate on top of the prompt rules: a validator may
// return a repair string (surfaced as the re-prompt) instead of false.
function withHonesty(schemaValidate) {
  return (d) => {
    if (!schemaValidate(d)) return false;
    const hits = findHonestyViolations(JSON.stringify(d));
    if (hits.length) return honestyRepairNudge(hits);
    return true;
  };
}

function readInputs(raw) {
  return {
    idea: cleanText(raw.idea, 600),
    audience: cleanText(raw.audience, 300),
    price_point: cleanText(raw.price_point, 120),
  };
}

async function buildPlan(env, inputs) {
  const spec = PLAN_PROMPT;
  const { parsed } = await runTextJson(env, MODELS[spec.model], [
    { role: "system", content: spec.system },
    { role: "user", content: spec.userTemplate(inputs) },
  ], {
    max_tokens: 4500, temperature: 0.6, retries: 2, label: "bizbuilder-plan",
    validate: withHonesty((d) =>
      d && typeof d.title === "string" && typeof d.concept === "string" &&
      typeof d.the_offer === "string" && Array.isArray(d.milestones_90_days)),
  });
  return parsed;
}

async function buildLanding(env, inputs) {
  const spec = LANDING_PROMPT;
  const { parsed } = await runTextJson(env, MODELS[spec.model], [
    { role: "system", content: spec.system },
    { role: "user", content: spec.userTemplate(inputs) },
  ], {
    max_tokens: 4000, temperature: 0.7, retries: 2, label: "bizbuilder-landing",
    validate: withHonesty((d) =>
      d && typeof d.hero_headline === "string" &&
      Array.isArray(d.benefits) && d.benefits.length >= 4 &&
      Array.isArray(d.faq) && d.faq.length >= 4),
  });
  return parsed;
}

async function buildEmails(env, inputs) {
  const spec = EMAILS_PROMPT;
  const { parsed } = await runTextJson(env, MODELS[spec.model], [
    { role: "system", content: spec.system },
    { role: "user", content: spec.userTemplate(inputs) },
  ], {
    max_tokens: 4500, temperature: 0.75, retries: 2, label: "bizbuilder-emails",
    validate: withHonesty((d) =>
      d && Array.isArray(d.emails) && d.emails.length === 5 &&
      d.emails.every((e) => e.subject && e.body)),
  });
  return parsed;
}

// ── renderers: styled web doc (HTML) + markdown companions ─────────────────

function renderPlanHtml(title, plan) {
  const secs = [
    ["The Concept", plan.concept],
    ["Target Customer", plan.target_customer],
    ["The Offer", plan.the_offer],
    ["Pricing & Unit Economics", plan.pricing_and_unit_economics],
    ["Go-to-Market: First 30 Days", plan.go_to_market_30_days],
    ["Startup Costs", plan.startup_costs],
    ["Risks & Honest Caveats", plan.risks_and_caveats],
  ];
  let h =
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${esc(title)} — Business Plan</title><style>` +
    `body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Helvetica,Arial,sans-serif;background:#0a0f1a;color:#eef3fb;margin:0;line-height:1.65}` +
    `.wrap{max-width:760px;margin:0 auto;padding:48px 24px}` +
    `h1{font-size:34px;letter-spacing:-.5px;margin:0 0 8px}` +
    `.sub{color:#93a1bb;margin:0 0 36px}` +
    `h2{font-size:20px;margin:36px 0 10px;color:#34d399}` +
    `p,li{color:#dbe4f3}` + `ul{padding-left:20px}` +
    `.milestones li{margin-bottom:6px}` +
    `.foot{margin-top:48px;padding-top:24px;border-top:1px solid #1c2942;color:#93a1bb;font-size:13px}` +
    `</style></head><body><div class="wrap">` +
    `<h1>${esc(title)}</h1><p class="sub">One-page business plan — generated by BizBuilder. Built to execute, not to impress.</p>`;
  for (const [label, body] of secs) {
    h += `<h2>${esc(label)}</h2>${para(body || "")}`;
  }
  h += `<h2>90-Day Milestones</h2><ul class="milestones">` +
    (plan.milestones_90_days || []).map((m) => `<li>${esc(m)}</li>`).join("") +
    `</ul><div class="foot">Delivered by BizBuilder · bizbuilder.mehyar.us · This plan is a starting point, not financial advice. Verify costs and demand before you spend.</div>` +
    `</div></body></html>`;
  return h;
}

function renderLandingMd(landing) {
  const L = [];
  L.push(`# Landing Page Copy\n`);
  L.push(`## Hero\n**${landing.hero_headline}**\n\n${landing.hero_subhead}\n\nCTA: _${landing.hero_cta}_\n`);
  L.push(`## Benefits`);
  for (const b of landing.benefits || []) L.push(`### ${b.title}\n${b.body}\n`);
  L.push(`## How it works`);
  (landing.how_it_works || []).forEach((s, i) => L.push(`${i + 1}. ${s}`));
  L.push(`\n## FAQ`);
  for (const f of landing.faq || []) L.push(`**Q: ${f.q}**\nA: ${f.a}\n`);
  L.push(`---\n${landing.final_cta}\n`);
  return L.join("\n");
}

function renderEmailsMd(emails) {
  const L = [`# 5-Email Welcome Sequence\n`];
  for (const e of emails || []) {
    L.push(`---\n## Day ${e.day} — ${e.subject}\n_Preview: ${e.preview}_\n\n${e.body}\n`);
  }
  return L.join("\n");
}

// ── handler ────────────────────────────────────────────────────────────────

export async function onRequestPost({ request, env }) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "bad_json" }, 400);
    }
    const order_token = String((body && body.order_token) || "");
    if (order_token.length < 16) return json({ ok: false, error: "invalid_token" }, 403);

    const order = await env.LEADS_DB.prepare(
      "SELECT * FROM bizbuilder_orders WHERE access_token = ?"
    ).bind(order_token).first();
    if (!order) return json({ ok: false, error: "unknown_order" }, 404);

    // Idempotent generate: a ready order returns its stored manifest.
    if (order.status === "ready" && order.output_json) {
      return json({ ok: true, replay: true, manifest: JSON.parse(order.output_json) });
    }

    let stored = {};
    try { stored = JSON.parse(order.inputs_json || "{}"); } catch {}
    const intake = (stored && stored.inputs) || {};
    const merged = Object.assign({}, intake, (body && body.inputs) || {});
    const inputs = readInputs(merged);
    if (!inputs.idea || !inputs.audience || !inputs.price_point) {
      return json({ ok: false, error: "missing_intake" }, 400);
    }

    // Three AI calls, bounded concurrency 3 (independent of each other).
    const results = await boundedMap(
      [
        { key: "plan", fn: () => buildPlan(env, inputs) },
        { key: "landing", fn: () => buildLanding(env, inputs) },
        { key: "emails", fn: () => buildEmails(env, inputs) },
      ],
      3,
      (item) => item.fn().then((value) => ({ key: item.key, value }))
    );
    const failed = results.filter((r) => !r.ok);
    if (failed.length) {
      throw new Error("build_failed:" + failed.map((f) => f.error).join(","));
    }
    const parts = {};
    for (const r of results) parts[r.value.key] = r.value.value;

    const title = String(parts.plan.title || "Your Business Plan").slice(0, 120);
    const planHtml = renderPlanHtml(title, parts.plan);
    const landingMd = renderLandingMd(parts.landing);
    const emailsMd = renderEmailsMd(parts.emails.emails);

    const manifest = {
      ok: true,
      title,
      inputs,
      summary: `Business plan + landing copy + 5-email sequence for "${title}".`,
      files: [
        { name: "business-plan.html", mime: "text/html", kind: "text", content: planHtml },
        { name: "landing-page-copy.md", mime: "text/markdown", kind: "text", content: landingMd },
        { name: "welcome-email-sequence.md", mime: "text/markdown", kind: "text", content: emailsMd },
        {
          name: "plan.json", mime: "application/json", kind: "text",
          content: JSON.stringify({ plan: parts.plan, landing: parts.landing, emails: parts.emails }, null, 2),
        },
      ],
      pdf_url: `/api/bizbuilder/pdf?token=${encodeURIComponent(order_token)}`,
      ready_at: new Date().toISOString(),
    };

    await env.LEADS_DB.prepare(
      `UPDATE bizbuilder_orders SET status='ready', output_json=?, ready_at=${nowSql} WHERE id=? AND status!='ready'`
    ).bind(JSON.stringify(manifest), order.id).run();

    return json({ ok: true, manifest });
  } catch (e) {
    console.error("bizbuilder/generate failed", e && e.message);
    return json({ ok: false, error: "generate_failed" }, 500);
  }
}
