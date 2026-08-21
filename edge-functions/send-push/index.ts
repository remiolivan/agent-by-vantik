import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// --- base64url helpers ---
function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function concatBytes(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.length; }
  return out;
}

// VAPID keys are generated once (web-push's generateVAPIDKeys, or any P-256
// key pair) and stored as raw base64url — the public key is also embedded
// in the frontend when calling pushManager.subscribe(), so this MUST match
// VAPID_PUBLIC_KEY exactly or every subscription will silently fail to
// authenticate against the push service.
async function importVapidPrivateKey(privB64url: string, pubB64url: string): Promise<CryptoKey> {
  const pubBytes = b64urlToBytes(pubB64url); // 65 bytes, uncompressed point 0x04|X|Y
  const x = pubBytes.slice(1, 33);
  const y = pubBytes.slice(33, 65);
  const d = b64urlToBytes(privB64url);
  const jwk: JsonWebKey = {
    kty: "EC", crv: "P-256",
    x: bytesToB64url(x), y: bytesToB64url(y), d: bytesToB64url(d),
    ext: true,
  };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function buildVapidAuthHeader(endpoint: string, vapidPrivateKey: CryptoKey, vapidPublicKeyB64url: string, subject: string): Promise<string> {
  const url = new URL(endpoint);
  const aud = `${url.protocol}//${url.host}`;
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud, exp: now + 12 * 3600, sub: subject };
  const enc = (obj: unknown) => bytesToB64url(new TextEncoder().encode(JSON.stringify(obj)));
  const unsigned = `${enc(header)}.${enc(payload)}`;
  const sigDer = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    vapidPrivateKey,
    new TextEncoder().encode(unsigned),
  );
  // WebCrypto ECDSA signatures are already raw (r||s) 64 bytes for P-256 — no DER conversion needed.
  const jwt = `${unsigned}.${bytesToB64url(new Uint8Array(sigDer))}`;
  return `vapid t=${jwt}, k=${vapidPublicKeyB64url}`;
}

// RFC 8291 (message encryption) + RFC 8188 (aes128gcm content-encoding).
// This is the single-record variant (whole payload fits in one record,
// which is always true here since our payloads are short JSON summaries).
async function encryptPayload(
  payloadBytes: Uint8Array,
  uaPublicB64url: string,
  uaAuthB64url: string,
): Promise<Uint8Array> {
  const uaPublicRaw = b64urlToBytes(uaPublicB64url); // 65 bytes
  const authSecret = b64urlToBytes(uaAuthB64url); // 16 bytes

  const uaPublicKey = await crypto.subtle.importKey(
    "raw", uaPublicRaw, { name: "ECDH", namedCurve: "P-256" }, false, [],
  );

  const asKeyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", asKeyPair.publicKey));

  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: uaPublicKey }, asKeyPair.privateKey, 256,
  );
  const ecdhSecret = new Uint8Array(sharedSecretBits);

  async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
    const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, data));
  }

  // "WebPush: info" key derivation (RFC 8291 §3.3)
  const prkKey = await hmacSha256(authSecret, ecdhSecret);
  const keyInfo = concatBytes(
    new TextEncoder().encode("WebPush: info\0"),
    uaPublicRaw, asPublicRaw,
  );
  const ikm = (await hmacSha256(prkKey, concatBytes(keyInfo, new Uint8Array([1])))).slice(0, 32);

  // aes128gcm content-encoding (RFC 8188)
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmacSha256(salt, ikm);
  const cekInfo = new TextEncoder().encode("Content-Encoding: aes128gcm\0");
  const cek = (await hmacSha256(prk, concatBytes(cekInfo, new Uint8Array([1])))).slice(0, 16);
  const nonceInfo = new TextEncoder().encode("Content-Encoding: nonce\0");
  const nonce = (await hmacSha256(prk, concatBytes(nonceInfo, new Uint8Array([1])))).slice(0, 12);

  // Single record: append a 0x02 delimiter byte ("last record") before encrypting.
  const recordPlain = concatBytes(payloadBytes, new Uint8Array([2]));
  const cekCryptoKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, cekCryptoKey, recordPlain));

  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096, false);

  return concatBytes(
    salt,
    recordSize,
    new Uint8Array([asPublicRaw.length]),
    asPublicRaw,
    ciphertext,
  );
}

export async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth_key: string },
  payload: Record<string, unknown>,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string,
): Promise<{ ok: boolean; status: number; shouldDelete: boolean }> {
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const body = await encryptPayload(payloadBytes, subscription.p256dh, subscription.auth_key);
  const privKey = await importVapidPrivateKey(vapidPrivateKey, vapidPublicKey);
  const authHeader = await buildVapidAuthHeader(subscription.endpoint, privKey, vapidPublicKey, vapidSubject);

  const res = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
    },
    body,
  });
  // 404/410 = the subscription is gone (user revoked permission, uninstalled, etc.) — caller should delete it.
  return { ok: res.ok, status: res.status, shouldDelete: res.status === 404 || res.status === 410 };
}

// Standalone HTTP entrypoint: sends a push to every device a given
// membership has subscribed on. Meant to be called from other server-side
// code (service role), not directly by end users.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const { title, body, url } = await req.json();
    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: membership } = await adminClient.from("memberships").select("id").eq("user_id", user.id).eq("status", "active").maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "No active membership" }), { status: 403, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const { data: subs } = await adminClient.from("push_subscriptions").select("*").eq("membership_id", membership.id);
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidSubject = "mailto:alerts@getvantik.com";

    let sent = 0;
    for (const sub of subs ?? []) {
      const result = await sendWebPush(sub, { title, body, url }, vapidPublicKey, vapidPrivateKey, vapidSubject);
      if (result.ok) sent++;
      if (result.shouldDelete) await adminClient.from("push_subscriptions").delete().eq("id", sub.id);
    }

    return new Response(JSON.stringify({ sent, total: (subs ?? []).length }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
