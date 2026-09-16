/* BizBuilder — shared app logic.
 *
 * PRODUCTION DEFAULT: buy buttons POST the real payload to
 * https://mehyar.us/api/pay/checkout and redirect to Stripe.
 * DEV MODE is opt-in ONLY via ?dev=1 (shows the payload modal instead of
 * charging). Never the default, never silent.
 */
"use strict";

/* Explicit opt-in: ?dev=1. Anything else = production checkout. */
const DEV_MODE = new URLSearchParams(window.location.search).get("dev") === "1";
const CHECKOUT_URL = "https://mehyar.us/api/pay/checkout";
const TEASER_URL = "/api/bizbuilder/teaser";
const GENERATE_URL = "/api/bizbuilder/generate";

/* Single product — no catalog. */
const PRODUCT = {
  id: "bizbuilder-plan",
  name: "BizBuilder — AI Business Builder",
  pitch: "Your idea becomes a one-page business plan, full landing-page copy, and a 5-email welcome sequence — styled web doc + PDF, delivered in minutes.",
  price: 17,
};

/* Last submitted teaser inputs — folded into the checkout params so the paid
 * pipeline starts with the buyer's intake. */
window.__teaserInputs = window.__teaserInputs || {};

/* ---------- helpers ---------- */
function $(sel, root) {
  return (root || document).querySelector(sel);
}
function $all(sel, root) {
  return Array.from((root || document).querySelectorAll(sel));
}
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email).trim());
}

/* ---------- teaser ---------- */
function wireTeaser() {
  const form = $("#teaser-form");
  if (!form) return;
  const errorEl = $("#teaser-error");
  const submit = $("#teaser-submit");
  const resultEl = $("#teaser-result");

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = !msg;
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    const idea = $("#t-idea").value.trim();
    const audience = $("#t-audience").value.trim();
    const price_point = $("#t-price").value.trim();
    if (!idea) { showError("Tell us your business idea first — a sentence or two is enough."); return; }
    if (!audience) { showError("Who's the target audience? One line is fine."); return; }
    if (!price_point) { showError("What's the price point? (e.g. $85 per groom, $19/mo)"); return; }
    showError("");
    submit.disabled = true;
    submit.textContent = "Building your excerpt…";

    let data = null;
    try {
      const res = await fetch(TEASER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, audience, price_point }),
      });
      data = await res.json().catch(() => null);
    } catch { /* fall through */ }

    submit.disabled = false;
    submit.textContent = "Generate my free excerpt";

    if (!data || !data.ok || !data.teaser) {
      const msg = (data && (data.message || data.error)) || "Something went wrong building the excerpt. Try again.";
      showError(String(msg).slice(0, 200));
      return;
    }

    /* Remember intake so the buy modal folds it into checkout params. */
    window.__teaserInputs = { idea, audience, price_point };

    const t = data.teaser;
    $("#teaser-summary").textContent = t.concept_summary || "";
    $("#teaser-customer").textContent = t.target_customer || "";
    $("#teaser-excerpt-title").textContent = t.plan_excerpt_title || "Plan excerpt";
    $("#teaser-excerpt").textContent = t.plan_excerpt || "";
    const miles = $("#teaser-milestones");
    miles.innerHTML = "";
    (t.launch_milestones || []).forEach(function (m) {
      const li = document.createElement("li");
      li.textContent = m;
      miles.appendChild(li);
    });
    $("#teaser-upgrade-note").textContent =
      (data.preview && data.preview.upgrade) || "Unlock the full $17 build for the complete plan.";
    resultEl.hidden = false;
    resultEl.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

/* ---------- buy modal ---------- */
let currentProduct = null;

function openBuyModal(product) {
  currentProduct = product;
  const modal = $("#buy-modal");
  $("#buy-product-name").textContent = product.name;
  $("#buy-product-price").textContent = "$" + product.price;
  $("#buy-product-pitch").textContent = product.pitch;
  $("#buy-email").value = "";
  $("#buy-error").textContent = "";
  modal.hidden = false;
  $("#buy-email").focus();
}

function closeBuyModal() {
  $("#buy-modal").hidden = true;
  currentProduct = null;
}

function checkoutPayload(email, params) {
  const payload = {
    product_id: PRODUCT.id,
    email: email,
    params: params || {},
  };
  if (DEV_MODE) payload.test = true; // dev checkout only ever hits test mode
  return payload;
}

function devCheckout(email, params) {
  const payload = checkoutPayload(email, params);
  $("#payload-pre").textContent = "POST " + CHECKOUT_URL + "\n\n" + JSON.stringify(payload, null, 2);
  $("#payload-modal").hidden = false;
}

async function liveCheckout(email, params) {
  const payload = checkoutPayload(email, params);
  let res;
  try {
    res = await fetch(CHECKOUT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return { ok: false, error: "Couldn't reach checkout — check your connection and try again." };
  }
  let data = null;
  try {
    data = await res.json();
  } catch { /* fall through */ }
  if (!res.ok || !data || data.ok !== true || !data.checkout_url) {
    const msg = (data && (data.message || data.error)) || ("Checkout failed (HTTP " + res.status + ").");
    return { ok: false, error: String(msg).slice(0, 200) };
  }
  window.location.href = data.checkout_url;
  return { ok: true };
}

function wireBuyButtons() {
  $all("[data-buy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      openBuyModal(PRODUCT);
    });
  });

  const close = $("#buy-close");
  if (close) close.addEventListener("click", closeBuyModal);
  const modal = $("#buy-modal");
  if (modal) modal.addEventListener("click", function (e) { if (e.target === modal) closeBuyModal(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeBuyModal(); });

  const buyForm = $("#buy-form");
  if (buyForm) buyForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const email = $("#buy-email").value.trim();
    const errEl = $("#buy-error");
    if (!validEmail(email)) {
      errEl.textContent = "Enter a valid email — your plan goes there.";
      return;
    }
    errEl.textContent = "";
    const btn = buyForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Starting secure checkout…";

    /* Fold the teaser intake into checkout params so the paid pipeline
     * starts with what the buyer already typed. */
    const params = {};
    const ti = window.__teaserInputs || {};
    if (ti.idea) {
      params.idea = String(ti.idea).slice(0, 600);
      params.audience = String(ti.audience || "").slice(0, 300);
      params.price_point = String(ti.price_point || "").slice(0, 120);
    }

    let result;
    if (DEV_MODE) {
      devCheckout(email, params);
      result = { ok: true };
    } else {
      result = await liveCheckout(email, params);
    }
    btn.disabled = false;
    btn.textContent = "Continue to checkout";
    if (!result.ok) {
      errEl.textContent = result.error || "Checkout failed — try again.";
    }
  });

  const payloadClose = $("#payload-close");
  if (payloadClose) payloadClose.addEventListener("click", function () {
    $("#payload-modal").hidden = true;
  });
}

/* ---------- subscribe form (shared footer) ---------- */
function wireSubscribe() {
  $all("[data-subscribe-form]").forEach(function (form) {
    const msg = form.querySelector(".subscribe-msg");
    function say(text, isErr) {
      if (!msg) return;
      msg.textContent = text;
      msg.hidden = false;
      msg.style.color = isErr ? "var(--err)" : "var(--ok)";
    }
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      const email = (form.querySelector('input[name="email"]') || {}).value || "";
      if (!validEmail(email)) { say("Enter a valid email address.", true); return; }
      say("Subscribing…");
      let res;
      try {
        res = await fetch("/api/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            phone: ((form.querySelector('input[name="phone"]') || {}).value || "").trim(),
            zip: ((form.querySelector('input[name="zip"]') || {}).value || "").trim(),
            sms_consent: !!(form.querySelector('input[name="sms_consent"]') || {}).checked,
            source: "bizbuilder",
          }),
        });
      } catch {
        say("Couldn't subscribe — check your connection.", true);
        return;
      }
      if (res.ok) {
        say("You're in. Watch your inbox.");
        form.reset();
      } else {
        say("Couldn't subscribe — try again.", true);
      }
    });
  });
}

/* ---------- dev banner ---------- */
function devBanner() {
  if (!DEV_MODE) return;
  const banner = document.createElement("div");
  banner.textContent = "DEV MODE (?dev=1) — no real checkout, no charges. Remove ?dev=1 for production.";
  banner.style.cssText = "position:fixed;top:0;left:0;right:0;background:#b91c1c;color:#fff;font-size:12px;text-align:center;padding:6px;z-index:9999";
  document.body.appendChild(banner);
  document.body.style.paddingTop = "28px";
}

document.addEventListener("DOMContentLoaded", function () {
  devBanner();
  wireTeaser();
  wireBuyButtons();
  wireSubscribe();
});
