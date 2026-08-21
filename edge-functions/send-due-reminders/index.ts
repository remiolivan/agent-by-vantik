import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// --- shared web push sending logic (duplicated from send-push/morning-digest
// since Supabase edge functions don't share code across functions without a
// separate published package) ---
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

// Runs every 15 min via pg_cron ("send-due-reminders-15min"). Unlike
// morning-digest (one summary/day, opt-in), this pushes a notification for
// each individual task/event as it approaches its due time/start time —
// a task/event reminder, not a once-a-day digest. Every member with at
// least one push subscription gets these by default (no separate opt-in
// toggle, since enabling push notifications at all already implies wanting
// them — see PushNotificationToggle's own copy: "Get notified for
// reminders and follow-ups on this device").
//
// Window: due_at/start_at falls between (now - BACK_WINDOW) and
// (now + FORWARD_WINDOW), and it hasn't been reminded yet
// (due_reminder_sent_at is null). The back-window matters more than it
// looks: the cron only runs at fixed :00/:15/:30/:45 marks, not
// continuously. A task created at 13:34 due at 13:38 falls in the gap
// between the 13:30 and 13:45 runs — by 13:45 its due_at is already in the
// past, so a naive "due_at >= now" check would silently skip it forever
// (this happened in production: v1 required due_at >= now and missed a
// task due mid-interval). Looking back up to BACK_WINDOW minutes catches
// anything that fell into that gap, while due_reminder_sent_at still
// guarantees each item is only ever reminded once.
Deno.serve(async (req: Request) => {
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== Deno.env.get("CRON_SECRET")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
  const vapidSubject = "mailto:alerts@getvantik.com";

  const now = new Date();
  const FORWARD_WINDOW_MS = 15 * 60 * 1000;
  // Twice the cron interval, so even a slightly delayed cron tick can't
  // reopen a gap the same way the original >= now check did.
  const BACK_WINDOW_MS = 30 * 60 * 1000;
  const windowStart = new Date(now.getTime() - BACK_WINDOW_MS);
  const windowEnd = new Date(now.getTime() + FORWARD_WINDOW_MS);

  let sent = 0;
  const errors: string[] = [];

  // Cache subscriptions per membership within this run so a member with
  // several due items in the same window doesn't trigger a repeat DB lookup
  // per item.
  const subsCache = new Map<string, { id: string; endpoint: string; p256dh: string; auth_key: string }[]>();
  async function subsFor(membershipId: string) {
    if (subsCache.has(membershipId)) return subsCache.get(membershipId)!;
    const { data } = await adminClient.from("push_subscriptions").select("*").eq("membership_id", membershipId);
    const subs = data ?? [];
    subsCache.set(membershipId, subs);
    return subs;
  }

  async function pushTo(membershipId: string, payload: Record<string, unknown>) {
    const subs = await subsFor(membershipId);
    for (const sub of subs) {
      const result = await sendWebPush(sub, payload, vapidPublicKey, vapidPrivateKey, vapidSubject);
      if (result.ok) sent++;
      if (result.shouldDelete) await adminClient.from("push_subscriptions").delete().eq("id", sub.id);
    }
  }

  try {
    const { data: dueTasks } = await adminClient
      .from("tasks")
      .select("id, title, due_at, assignee_id")
      .is("completed_at", null)
      .is("due_reminder_sent_at", null)
      .not("due_at", "is", null)
      .not("assignee_id", "is", null)
      .lte("due_at", windowEnd.toISOString())
      .gte("due_at", windowStart.toISOString());

    for (const task of dueTasks ?? []) {
      try {
        const dueTime = new Date(task.due_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        await pushTo(task.assignee_id, { title: "Task due soon", body: `${task.title} — ${dueTime}`, url: "/tasks" });
        await adminClient.from("tasks").update({ due_reminder_sent_at: new Date().toISOString() }).eq("id", task.id);
      } catch (e) {
        errors.push(`task ${task.id}: ${String(e)}`);
      }
    }
  } catch (e) {
    errors.push(`tasks query: ${String(e)}`);
  }

  try {
    const { data: dueEvents } = await adminClient
      .from("calendar_events")
      .select("id, title, start_at, created_by")
      .is("due_reminder_sent_at", null)
      .not("created_by", "is", null)
      .lte("start_at", windowEnd.toISOString())
      .gte("start_at", windowStart.toISOString());

    for (const ev of dueEvents ?? []) {
      try {
        const startTime = new Date(ev.start_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        await pushTo(ev.created_by, { title: "Upcoming appointment", body: `${ev.title} — ${startTime}`, url: "/calendar" });
        await adminClient.from("calendar_events").update({ due_reminder_sent_at: new Date().toISOString() }).eq("id", ev.id);
      } catch (e) {
        errors.push(`event ${ev.id}: ${String(e)}`);
      }
    }
  } catch (e) {
    errors.push(`events query: ${String(e)}`);
  }

  return new Response(JSON.stringify({ sent, errors }), { status: 200, headers: { "Content-Type": "application/json" } });
});
