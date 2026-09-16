-- pwa/schema.sql — BizBuilder PWA schema + billing catalog seed.
-- Apply to the shared mehyar_leads_prod D1. Safe to re-run (IF NOT EXISTS / upserts).
-- NOTE: nothing in ~/workspace/repos/mehyar-web is touched by this file.

-- ── orders: one row per paid BizBuilder purchase ───────────────────────────
CREATE TABLE IF NOT EXISTS bizbuilder_orders (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id    INTEGER NOT NULL,          -- billing_payments.id (unique: idempotent fulfill)
  product_id    TEXT NOT NULL,             -- billing_products.id
  email         TEXT NOT NULL,
  inputs_json   TEXT NOT NULL DEFAULT '{}',-- {inputs:{idea, audience, price_point}}
  status        TEXT NOT NULL DEFAULT 'paid', -- paid|ready|failed
  output_json   TEXT,                      -- deliverable manifest (files inline + pdf_url)
  access_token  TEXT NOT NULL,             -- unguessable buyer capability token
  created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ready_at      TEXT
);

CREATE INDEX IF NOT EXISTS idx_bizbuilder_orders_token ON bizbuilder_orders(access_token);
-- Idempotency key for the webhook fulfillment hook (one order per payment).
CREATE UNIQUE INDEX IF NOT EXISTS idx_bizbuilder_orders_payment ON bizbuilder_orders(payment_id);

-- ── billing catalog: 1 SKU @ $17, fulfillment='bizbuilder' ─────────────────
-- success_url_template: Stripe {access_token} is the bizbuilder_orders token,
-- written by fulfillBizbuilder at webhook time (see pwa/fulfill-bizbuilder.js).

INSERT INTO billing_products
  (id, name, brand, price_cents, currency, fulfillment, description, success_url_template, cancel_url, allowed_return_hosts, active, digital_file)
VALUES
  ('bizbuilder-plan', 'BizBuilder — AI Business Builder', 'bizbuilder', 1700, 'usd', 'bizbuilder',
   'Your business idea becomes a one-page business plan, full landing-page copy, and a 5-email welcome sequence — delivered as a styled web doc + PDF.',
   'https://bizbuilder.mehyar.us/success.html?token={access_token}',
   'https://bizbuilder.mehyar.us/#pricing', 'bizbuilder.mehyar.us', 1, NULL)
ON CONFLICT(id) DO UPDATE SET name=excluded.name, price_cents=excluded.price_cents,
  fulfillment=excluded.fulfillment, description=excluded.description,
  success_url_template=excluded.success_url_template, cancel_url=excluded.cancel_url,
  allowed_return_hosts=excluded.allowed_return_hosts, active=excluded.active;
