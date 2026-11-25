// Oh no, è finito! — servizio per le notifiche push (Cloudflare Worker).
//
// L'app chiama POST /notify con le iscrizioni push degli altri componenti della casa
// e il testo della notifica; il worker cifra il messaggio (RFC 8291, aes128gcm),
// lo firma con le chiavi VAPID (RFC 8292) e lo consegna ai servizi push
// (Apple, Google, Mozilla, Microsoft). Nessuna dipendenza: solo WebCrypto.
//
// Variabili del worker:
//   VAPID_PRIVATE_JWK  (segreto)  chiave privata VAPID in formato JWK (JSON)
//   VAPID_SUBJECT      contatto richiesto dai servizi push (URL https o mailto:)
//   ALLOWED_ORIGINS    origini ammesse, separate da virgola

const PUSH_HOSTS = [/\.push\.apple\.com$/, /^fcm\.googleapis\.com$/, /\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/];
const MAX_SUBS = 20;
const enc = new TextEncoder();

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
    const cors = {
      "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0] || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    };
    const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method === "GET" && url.pathname === "/vapid-public-key") {
      const jwk = JSON.parse(env.VAPID_PRIVATE_JWK);
      return json(200, { key: b64url(publicKeyRaw(jwk)) });
    }
    if (request.method !== "POST" || url.pathname !== "/notify") return json(404, { error: "not_found" });
    if (allowed.length && !allowed.includes(origin)) return json(403, { error: "origin_not_allowed" });

    let input;
    try { input = await request.json(); } catch { return json(400, { error: "bad_json" }); }
    const subs = Array.isArray(input.subscriptions) ? input.subscriptions.slice(0, MAX_SUBS) : [];
    const payload = {
      title: String(input.title || "Oh no, è finito!").slice(0, 80),
      body: String(input.body || "").slice(0, 300),
      url: String(input.url || "./").slice(0, 200),
      tag: String(input.tag || "spesa").slice(0, 32),
    };
    if (!subs.length) return json(400, { error: "no_subscriptions" });

    const vapidKey = await importVapidKey(env.VAPID_PRIVATE_JWK);
    const results = await Promise.all(subs.map(async s => {
      try {
        if (!validSubscription(s)) return { endpoint: s && s.endpoint, status: "invalid" };
        const res = await sendPush(s, JSON.stringify(payload), vapidKey, env.VAPID_SUBJECT, payload.tag);
        if (res.status === 404 || res.status === 410) return { endpoint: s.endpoint, status: "gone" };
        if (res.ok) return { endpoint: s.endpoint, status: "sent", code: res.status };
        const reason = (await res.text().catch(() => "")).slice(0, 120);
        return { endpoint: s.endpoint, status: "error", code: res.status, reason };
      } catch (e) {
        return { endpoint: s && s.endpoint, status: "error", code: 0 };
      }
    }));
    return json(200, {
      sent: results.filter(r => r.status === "sent").length,
      gone: results.filter(r => r.status === "gone" || r.status === "invalid").map(r => r.endpoint),
      results,
    });
  },
};

function validSubscription(s) {
  if (!s || typeof s.endpoint !== "string" || !s.keys) return false;
  let u;
  try { u = new URL(s.endpoint); } catch { return false; }
  if (u.protocol !== "https:" || !PUSH_HOSTS.some(re => re.test(u.hostname))) return false;
  try { return b64urlDecode(s.keys.p256dh).length === 65 && b64urlDecode(s.keys.auth).length === 16; } catch { return false; }
}

// ---------- invio di un messaggio ----------
export async function sendPush(sub, text, vapidKey, subject, topic) {
  const body = await encryptPayload(sub.keys.p256dh, sub.keys.auth, enc.encode(text));
  const aud = new URL(sub.endpoint).origin;
  const jwt = await vapidJwt(aud, subject, vapidKey.privateKey);
  const headers = {
    "Content-Encoding": "aes128gcm",
    "Content-Type": "application/octet-stream",
    "TTL": "86400",
    "Urgency": "normal",
    "Authorization": `vapid t=${jwt}, k=${vapidKey.publicB64}`,
  };
  if (topic && /^[A-Za-z0-9_-]{1,32}$/.test(topic)) headers["Topic"] = topic;
  return fetch(sub.endpoint, { method: "POST", headers, body });
}

// ---------- VAPID (RFC 8292) ----------
export async function importVapidKey(jwkText) {
  const jwk = typeof jwkText === "string" ? JSON.parse(jwkText) : jwkText;
  const privateKey = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", d: jwk.d, x: jwk.x, y: jwk.y, ext: true },
    { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  return { privateKey, publicB64: b64url(publicKeyRaw(jwk)) };
}
function publicKeyRaw(jwk) {
  return concat(new Uint8Array([4]), b64urlDecode(jwk.x), b64urlDecode(jwk.y));
}
async function vapidJwt(aud, subject, privateKey) {
  const header = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64url(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject || "https://omgiian.github.io/ohnoefinito/" })));
  const data = `${header}.${claims}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, enc.encode(data)));
  return `${data}.${b64url(sig)}`;
}

// ---------- cifratura del messaggio (RFC 8291, aes128gcm) ----------
export async function encryptPayload(p256dhB64, authB64, plaintext) {
  const uaPublic = b64urlDecode(p256dhB64);
  const authSecret = b64urlDecode(authB64);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const asKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", asKeys.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asKeys.privateKey, 256));

  const keyInfo = concat(enc.encode("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  const padded = concat(plaintext, new Uint8Array([2]));   // ultimo (e unico) blocco
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, padded));

  const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, cipher);
}
async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8));
}

// ---------- utilità ----------
function concat(...arrays) {
  const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
  let i = 0;
  for (const a of arrays) { out.set(a, i); i += a.length; }
  return out;
}
export function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function b64urlDecode(str) {
  const s = String(str).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}
