// functions/api/bizbuilder/_lib/inputs.js
// Shared input sanitization for BizBuilder endpoints.
// Imported by teaser.js and generate.js so both enforce the same rules.

export function cleanText(s, max = 4000) {
  if (typeof s !== "string") return "";
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function cleanUrl(s) {
  if (typeof s !== "string") return "";
  let u = s.trim().slice(0, 2048);
  if (u && !/^[a-z][a-z0-9+.-]*:\/\//i.test(u)) u = "https://" + u;
  return u;
}

// SSRF screen: blocks the obvious internal targets. A determined attacker
// can still DNS-rebind; go-live hardening (DNS pinning / egress allowlist)
// is tracked in INTEGRATION.md.
export function isSafeFetchUrl(u) {
  let url;
  try {
    url = new URL(u);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  if (host === "metadata.google.internal" || host === "169.254.169.254") return false;
  if (/^127\./.test(host) || host === "::1" || host === "[::1]") return false;
  if (/^10\./.test(host) || /^192\.168\./.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
  if (/^0\./.test(host)) return false;
  return true;
}

export function extractVisibleText(html, max = 8000) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export async function fetchPageText(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const resp = await fetch(url, {
      signal: ctrl.signal,
      headers: { "user-agent": "BizBuilderBot/1.0 (+https://bizbuilder.mehyar.us)" },
      redirect: "follow",
    });
    if (!resp.ok) return { ok: false, error: "fetch_" + resp.status };
    const ct = resp.headers.get("content-type") || "";
    if (!/text\/html|text\/plain|application\/xhtml/i.test(ct)) {
      return { ok: false, error: "not_html" };
    }
    const html = await resp.text();
    return { ok: true, text: extractVisibleText(html) };
  } catch (e) {
    return { ok: false, error: "fetch_failed" };
  } finally {
    clearTimeout(t);
  }
}
