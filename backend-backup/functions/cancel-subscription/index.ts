import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@16";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

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
    if (userErr || !user) return json({ error: "Not authenticated" }, 401);

    const { reason } = await req.json().catch(() => ({ reason: null }));

    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: membership } = await adminClient
      .from("memberships").select("org_id, role").eq("user_id", user.id).eq("status", "active").maybeSingle();
    if (!membership) return json({ error: "No active membership" }, 403);
    if (!["owner", "admin"].includes(membership.role)) {
      return json({ error: "Only owners or admins can cancel the subscription" }, 403);
    }

    const { data: org, error: orgErr } = await adminClient
      .from("organizations").select("id, is_comped").eq("id", membership.org_id).single();
    if (orgErr || !org) return json({ error: "Organization not found" }, 404);
    if (org.is_comped) return json({ error: "Comped accounts don't have a subscription to cancel" }, 400);

    // The Stripe subscription id lives in the subscriptions table (written by stripe-webhook).
    const { data: sub, error: subErr } = await adminClient
      .from("subscriptions")
      .select("id, stripe_subscription_id")
      .eq("org_id", org.id)
      .in("status", ["active", "trialing", "past_due"])
      .not("stripe_subscription_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (subErr) return json({ error: subErr.message }, 500);
    if (!sub) return json({ error: "No active subscription found" }, 400);

    // Cancel at period end: access continues, no prorated refund.
    // stripe-webhook (customer.subscription.updated / .deleted) keeps the DB in sync.
    const subscription = await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    await adminClient.from("subscriptions").update({
      cancel_at_period_end: true,
      updated_at: new Date().toISOString(),
    }).eq("id", sub.id);

    await adminClient.from("organizations").update({
      cancel_requested_at: new Date().toISOString(),
      cancellation_reason: reason || null,
    }).eq("id", org.id);

    // deno-lint-ignore no-explicit-any
    const s = subscription as any;
    const endTs = s.cancel_at ?? s.current_period_end ?? s.items?.data?.[0]?.current_period_end;
    return json({
      success: true,
      cancel_at: typeof endTs === "number" ? new Date(endTs * 1000).toISOString() : null,
    });
  } catch (e) {
    console.error("[cancel-subscription] error:", (e as Error)?.message ?? e);
    return json({ error: "Could not cancel the subscription. Please try again or contact remi.olivan@getvantik.com." }, 500);
  }
});
