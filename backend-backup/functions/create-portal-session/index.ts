import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@16";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
    const authHeader = req.headers.get("Authorization") ?? "";

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: membership } = await adminClient
      .from("memberships").select("org_id, role").eq("user_id", user.id).eq("status", "active").maybeSingle();
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return new Response(JSON.stringify({ error: "Only owners or admins can manage billing" }), { status: 403, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const { data: org } = await adminClient.from("organizations").select("stripe_customer_id").eq("id", membership.org_id).single();
    if (!org?.stripe_customer_id) {
      return new Response(JSON.stringify({ error: "No billing account yet" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const origin = req.headers.get("origin") ?? "https://agent.getvantik.com";
    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${origin}/billing`,
    });

    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[create-portal-session] error:", (e as Error)?.message ?? e);
    return new Response(JSON.stringify({ error: "Could not open billing portal. Please try again or contact remi.olivan@getvantik.com." }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
