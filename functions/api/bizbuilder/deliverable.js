// functions/api/bizbuilder/deliverable.js
// GET /api/bizbuilder/deliverable?token=<access_token>
// Returns the buyer's manifest (plan HTML, landing copy, email sequence,
// PDF link). The access token is the capability — no other auth.

export async function onRequestGet({ request, env }) {
  const token = new URL(request.url).searchParams.get("token") || "";
  if (token.length < 16) {
    return Response.json({ ok: false, error: "invalid_token" }, { status: 403 });
  }
  const order = await env.LEADS_DB.prepare(
    "SELECT * FROM bizbuilder_orders WHERE access_token = ?"
  ).bind(token).first();
  if (!order) {
    return Response.json({ ok: false, error: "unknown_order" }, { status: 404 });
  }
  if (order.status !== "ready" || !order.output_json) {
    return Response.json(
      { ok: false, error: "not_ready", status: order.status },
      { status: 409 }
    );
  }
  let manifest;
  try {
    manifest = JSON.parse(order.output_json);
  } catch {
    return Response.json({ ok: false, error: "manifest_corrupt" }, { status: 500 });
  }
  return Response.json(
    { ok: true, status: order.status, product_id: order.product_id, manifest },
    { headers: { "content-type": "application/json", "cache-control": "no-store" } }
  );
}
