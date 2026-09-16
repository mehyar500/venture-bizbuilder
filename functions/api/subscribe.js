// functions/api/subscribe.js
// POST /api/subscribe — { email, phone?, zip?, sms_consent? }
// BizBuilder newsletter signup. Mirrors the roastme/crayonkid capture pattern:
// email is the only required field; phone and zip are OPTIONAL (clearly
// marked so in the form). Light validation only — never reject real users.
//
// Stores locally in LEADS_DB (bizbuilder_captures + bizbuilder_unsub_tokens)
// and syncs to the central email_contact store (brand='bizbuilder') via the
// campaign-manager's sync_bizbuilder_captures.py job, which also mints
// warmup_unsub_tokens so every marketing email can carry List-Unsubscribe.
// Returns { ok:true, unsub_url } — the unsub URL must accompany every
// BizBuilder email that references this capture.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BRAND = "bizbuilder";
const UNSUB_BASE = "https://bizbuilder.mehyar.us/api/unsubscribe";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

// Cheap in-memory rate limit: 10 signups / 15 min / IP (per isolate).
const RL = new Map();
function rateLimitOk(ip) {
  const now = Date.now();
  const arr = (RL.get(ip) || []).filter((ts) => now - ts < 15 * 60 * 1000);
  if (arr.length >= 10) return false;
  arr.push(now);
  RL.set(ip, arr);
  return true;
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env?.LEADS_DB) return json({ ok: false, error: "service_unavailable" }, 503);
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    if (!rateLimitOk(ip)) return json({ ok: false, error: "rate_limited" }, 429);

    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
    if (!EMAIL_RE.test(email)) return json({ ok: false, error: "invalid_email" }, 400);

    // Optional fields: stored as given (trimmed, length-capped). No format
    // rejection — a weird-but-real phone number still belongs to a real user.
    const phone = String(body.phone || "").trim().slice(0, 40) || null;
    const zip = String(body.zip || "").trim().slice(0, 20) || null;
    // SMS consent is a separate explicit opt-in checkbox, never implied by
    // merely providing a phone number (TCPA-friendly).
    const smsConsent = body.sms_consent === true || body.sms_consent === "true" ? 1 : 0;
    const consentAt = smsConsent ? new Date().toISOString() : null;

    const db = env.LEADS_DB;
    await db
      .prepare(
        "CREATE TABLE IF NOT EXISTS bizbuilder_captures (" +
          "id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, " +
          "phone TEXT, zip TEXT, sms_consent INTEGER NOT NULL DEFAULT 0, " +
          "consent_at TEXT, ip TEXT, source TEXT NOT NULL DEFAULT 'web', " +
          "unsubscribed INTEGER NOT NULL DEFAULT 0, synced INTEGER NOT NULL DEFAULT 0, " +
          "created_at TEXT NOT NULL DEFAULT (datetime('now')))"
      )
      .run()
      .catch(() => {});
    await db
      .prepare(
        "INSERT INTO bizbuilder_captures (email, phone, zip, sms_consent, consent_at, ip) " +
          "VALUES (?, ?, ?, ?, ?, ?)"
      )
      .bind(email, phone, zip, smsConsent, consentAt, ip.slice(0, 64))
      .run()
      .catch((e) => console.error("api/subscribe capture insert failed", e && e.message));

    // One-click unsubscribe token (random bearer, stored server-side).
    await db
      .prepare(
        "CREATE TABLE IF NOT EXISTS bizbuilder_unsub_tokens (token TEXT PRIMARY KEY, email TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))"
      )
      .run()
      .catch(() => {});
    const token = crypto.randomUUID();
    await db
      .prepare("INSERT OR REPLACE INTO bizbuilder_unsub_tokens (token, email) VALUES (?, ?)")
      .bind(token, email)
      .run()
      .catch((e) => console.error("api/subscribe token store failed", e && e.message));

    return json({ ok: true, brand: BRAND, unsub_url: `${UNSUB_BASE}?token=${token}` });
  } catch (e) {
    console.error("api/subscribe error", e && e.message);
    return json({ ok: false, error: "subscribe_failed" }, 500);
  }
}
