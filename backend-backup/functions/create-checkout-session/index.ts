import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@16";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Each plan/interval has its own secret. The value can be either a Stripe
// price id (price_...) or a product id (prod_...) whose default price is the
// recurring price for that plan/interval (one product per plan/interval).
const PRICE_ENV: Record<string, string> = {
  solo_monthly: "STRIPE_PRICE_SOLO_MONTHLY",
  solo_annual: "STRIPE_PRICE_SOLO_ANNUAL",
  team_monthly: "STRIPE_PRICE_TEAM_MONTHLY",
  team_annual: "STRIPE_PRICE_TEAM_ANNUAL",
};

const jsonRes = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function resolvePriceId(stripe: Stripe, value: string): Promise<string> {
  if (value.startsWith("price_")) return value;
  if (value.startsWith("prod_")) {
    const product = await stripe.products.retrieve(value);
    const dp = product.default_price;
    const id = typeof dp === "string" ? dp : dp?.id;
    if (id) return id;
    const list = await stripe.prices.list({ product: value, active: true, limit: 2 });
    if (list.data.length === 1) return list.data[0].id;
    throw new Error(`Product ${value} has ${list.data.length} active prices and no default price`);
  }
  throw new Error(`Value does not look like a Stripe price or product id (starts with ${value.slice(0, 5)})`);
}

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
    if (userErr || !user) return jsonRes({ error: "Not authenticated" }, 401);

    const { plan, interval } = await req.json();
    const normalizedInterval = interval === "annual" ? "annual" : "monthly";
    const priceKey = `${plan}_${normalizedInterval}`;
    const envName = PRICE_ENV[priceKey];
    const configured = envName ? Deno.env.get(envName)?.trim() : undefined;
    if (!envName || !configured) {
      console.error(`[create-checkout-session] missing secret for ${priceKey} (${envName ?? "unknown plan"})`);
      return jsonRes({ error: `Unknown or unconfigured plan: ${priceKey}` }, 400);
    }

    let priceId: string;
    try {
      priceId = await resolvePriceId(stripe, configured);
    } catch (e) {
      // Usually: key and product/price come from different Stripe environments (live vs sandbox).
      console.error(`[create-checkout-session] cannot resolve ${envName}:`, (e as Error)?.message ?? e);
      return jsonRes({ error: "Billing is temporarily unavailable. Please try again later or contact remi.olivan@getvantik.com." }, 500);
    }

    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: membership, error: memErr } = await adminClient
      .from("memberships").select("org_id, role").eq("user_id", user.id).eq("status", "active").maybeSingle();
    if (memErr || !membership) return jsonRes({ error: "No active membership" }, 403);
    if (!["owner", "admin"].includes(membership.role)) {
      return jsonRes({ error: "Only owners or admins can manage billing" }, 403);
    }

    const { data: org } = await adminClient.from("organizations").select("id, name, stripe_customer_id").eq("id", membership.org_id).single();

    // Block a second paid subscription: changes go through the customer portal.
    const { data: existing } = await adminClient
      .from("subscriptions").select("id")
      .eq("org_id", org.id).in("status", ["active", "trialing", "past_due"]).limit(1);
    if (existing && existing.length > 0) {
      return jsonRes({
        error: "Your organization already has an active subscription. Use \"Manage billing\" to change or cancel it.",
        code: "already_subscribed",
      }, 409);
    }

    let customerId = org.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ name: org.name, email: user.email, metadata: { org_id: org.id } });
      customerId = customer.id;
      await adminClient.from("organizations").update({ stripe_customer_id: customerId }).eq("id", org.id);
    }

    const origin = req.headers.get("origin") ?? "https://agent.getvantik.com";
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/billing?success=true`,
      cancel_url: `${origin}/billing?canceled=true`,
      metadata: { org_id: org.id, plan, interval: normalizedInterval },
      subscription_data: { metadata: { org_id: org.id, plan, interval: normalizedInterval } },
    });

    return jsonRes({ url: session.url }, 200);
  } catch (e) {
    console.error("[create-checkout-session] error:", (e as Error)?.message ?? e);
    return jsonRes({ error: "Something went wrong starting checkout. Please try again or contact remi.olivan@getvantik.com." }, 500);
  }
});
