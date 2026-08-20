import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Public, unauthenticated redirect endpoint: turns a short share code
// (e.g. /functions/v1/share/aB3xQ9kP) into a freshly-signed, direct link to
// the underlying PDF in Storage. This exists so links sent over WhatsApp/email
// are short and readable instead of a raw Supabase signed-URL (which embeds a
// long JWT query string). The signed URL is generated at click time, so the
// short link itself doesn't need to carry an expiry — it just points at a
// stable storage path.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  const code = url.pathname.split("/").filter(Boolean).pop();

  if (!code) {
    return new Response("Missing share code", { status: 400, headers: CORS });
  }

  const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: link, error } = await adminClient
    .from("shared_links")
    .select("bucket, storage_path, expires_at")
    .eq("code", code)
    .maybeSingle();

  if (error || !link) {
    return new Response("This link is invalid or has expired.", { status: 404, headers: CORS });
  }

  if (new Date(link.expires_at).getTime() < Date.now()) {
    return new Response("This link has expired.", { status: 410, headers: CORS });
  }

  const { data: signed, error: signErr } = await adminClient.storage
    .from(link.bucket)
    .createSignedUrl(link.storage_path, 60 * 10); // 10 minutes is plenty to load/download

  if (signErr || !signed) {
    return new Response("Could not generate the file link.", { status: 500, headers: CORS });
  }

  return new Response(null, { status: 302, headers: { ...CORS, Location: signed.signedUrl } });
});
