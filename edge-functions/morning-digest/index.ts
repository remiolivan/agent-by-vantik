import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// --- shared web push sending logic (duplicated from send-push since Supabase
// edge functions don't share code across functions without a separate
// published package) ---
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
async function importVapidPrivateKey(privB64url: string, pubB64url: string): Promise<CryptoKey> {
  const pubBytes = b64urlToBytes(pubB64url);
  const x = pubBytes.slice(1, 33);
  const y = pubBytes.slice(33, 65);
  const d = b64urlToBytes(privB64url);
  const jwk: JsonWebKey = { kty: "EC", crv: "P-256", x: bytesToB64url(x), y: bytesToB64url(y), d: bytesToB64url(d), ext: true };
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
  const sigDer = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, vapidPrivateKey, new TextEncoder().encode(unsigned));
  return `vapid t=${unsigned}.${bytesToB64url(new Uint8Array(sigDer))}, k=${vapidPublicKeyB64url}`;
}
async function encryptPayload(payloadBytes: Uint8Array, uaPublicB64url: string, uaAuthB64url: string): Promise<Uint8Array> {
  const uaPublicRaw = b64urlToBytes(uaPublicB64url);
  const authSecret = b64urlToBytes(uaAuthB64url);
  const uaPublicKey = await crypto.subtle.importKey("raw", uaPublicRaw, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const asKeyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", asKeyPair.publicKey));
  const sharedSecretBits = await crypto.subtle.deriveBits({ name: "ECDH", public: uaPublicKey }, asKeyPair.privateKey, 256);
  const ecdhSecret = new Uint8Array(sharedSecretBits);
  async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
    const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, data));
  }
  const prkKey = await hmacSha256(authSecret, ecdhSecret);
  const keyInfo = concatBytes(new TextEncoder().encode("WebPush: info\0"), uaPublicRaw, asPublicRaw);
  const ikm = (await hmacSha256(prkKey, concatBytes(keyInfo, new Uint8Array([1])))).slice(0, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmacSha256(salt, ikm);
  const cekInfo = new TextEncoder().encode("Content-Encoding: aes128gcm\0");
  const cek = (await hmacSha256(prk, concatBytes(cekInfo, new Uint8Array([1])))).slice(0, 16);
  const nonceInfo = new TextEncoder().encode("Content-Encoding: nonce\0");
  const nonce = (await hmacSha256(prk, concatBytes(nonceInfo, new Uint8Array([1])))).slice(0, 12);
  const recordPlain = concatBytes(payloadBytes, new Uint8Array([2]));
  const cekCryptoKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, cekCryptoKey, recordPlain));
  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096, false);
  return concatBytes(salt, recordSize, new Uint8Array([asPublicRaw.length]), asPublicRaw, ciphertext);
}
async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth_key: string },
  payload: Record<string, unknown>,
  vapidPublicKey: string, vapidPrivateKey: string, vapidSubject: string,
): Promise<{ ok: boolean; status: number; shouldDelete: boolean }> {
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const body = await encryptPayload(payloadBytes, subscription.p256dh, subscription.auth_key);
  const privKey = await importVapidPrivateKey(vapidPrivateKey, vapidPublicKey);
  const authHeader = await buildVapidAuthHeader(subscription.endpoint, privKey, vapidPublicKey, vapidSubject);
  const res = await fetch(subscription.endpoint, {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "86400" },
    body,
  });
  return { ok: res.ok, status: res.status, shouldDelete: res.status === 404 || res.status === 410 };
}

// Meant to run once every morning via pg_cron (see send-reminders for the
// same pattern). For every member who opted in, builds a short summary of
// today's open tasks and calendar events and pushes it as one notification.
Deno.serve(async (req: Request) => {
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== Deno.env.get("CRON_SECRET")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
  const vapidSubject = "mailto:alerts@getvantik.com";

  const { data: optedIn } = await adminClient
    .from("memberships")
    .select("id, org_id")
    .eq("morning_digest_enabled", true)
    .eq("status", "active");

  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);

  let sent = 0;
  const errors: string[] = [];

  for (const member of optedIn ?? []) {
    try {
      const { data: subs } = await adminClient.from("push_subscriptions").select("*").eq("membership_id", member.id);
      if (!subs || subs.length === 0) continue; // opted in but no device subscribed — nothing to send to

      const [{ count: taskCount }, { count: eventCount }] = await Promise.all([
        adminClient.from("tasks").select("*", { count: "exact", head: true })
          .eq("org_id", member.org_id).eq("assignee_id", member.id)
          .is("completed_at", null).lte("due_at", endOfDay.toISOString()),
        adminClient.from("calendar_events").select("*", { count: "exact", head: true })
          .eq("org_id", member.org_id)
          .gte("start_at", startOfDay.toISOString()).lte("start_at", endOfDay.toISOString()),
      ]);

      if (!taskCount && !eventCount) continue; // nothing due today — skip the notification entirely rather than send an empty one

      const parts: string[] = [];
      if (taskCount) parts.push(`${taskCount} task${taskCount === 1 ? "" : "s"} due`);
      if (eventCount) parts.push(`${eventCount} appointment${eventCount === 1 ? "" : "s"}`);
      const body = parts.join(" · ");

      for (const sub of subs) {
        const result = await sendWebPush(sub, { title: "Today", body, url: "/" }, vapidPublicKey, vapidPrivateKey, vapidSubject);
        if (result.ok) sent++;
        if (result.shouldDelete) await adminClient.from("push_subscriptions").delete().eq("id", sub.id);
      }
    } catch (e) {
      errors.push(String(e));
    }
  }

  return new Response(JSON.stringify({ sent, errors }), { status: 200, headers: { "Content-Type": "application/json" } });
});
