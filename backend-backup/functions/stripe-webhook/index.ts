import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@16";

// NOTE: the Stripe webhook endpoint is on API version 2026-08-26.dahlia, so
// event payloads use the new shape (current_period_end lives on subscription
// items, not on the subscription). The SDK client below still calls the API
// with 2024-06-20, so objects we retrieve ourselves use the old shape.
// periodEnd() handles both.
//
// Access rule (mirrored in the front, src/lib/access.js): an org keeps a paid
// plan while its subscription is active / trialing / past_due. When Stripe
// gives up (unpaid, incomplete_expired, paused, canceled) the org drops back
// to 'trial', which locks it once trial_ends_at has passed.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// Stripe id -> { plan, interval }. The secrets may hold a price id (price_...)
// or a product id (prod_...), so we match on either.
const PLAN_MAP: Record<string, { plan: string; interval: string }> = {};
for (const [env, plan, interval] of [
  ["STRIPE_PRICE_SOLO_MONTHLY", "solo", "monthly"],
  ["STRIPE_PRICE_SOLO_ANNUAL", "solo", "annual"],
  ["STRIPE_PRICE_TEAM_MONTHLY", "team", "monthly"],
  ["STRIPE_PRICE_TEAM_ANNUAL", "team", "annual"],
]) {
  const id = Deno.env.get(env)?.trim();
  if (id) PLAN_MAP[id] = { plan, interval };
}

const ACTIVE_STATUSES = ["active", "trialing", "past_due"];
const LOST_STATUSES = ["unpaid", "incomplete_expired", "paused", "canceled"];

// deno-lint-ignore no-explicit-any
function periodEnd(sub: any): string | null {
  const ts = sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end;
  return typeof ts === "number" ? new Date(ts * 1000).toISOString() : null;
}

// deno-lint-ignore no-explicit-any
function planFromSub(sub: any): { plan: string | null; interval: string | null } {
  const price = sub?.items?.data?.[0]?.price;
  const priceId = price?.id;
  const productId = typeof price?.product === "string" ? price.product : price?.product?.id;
  const hit = (priceId && PLAN_MAP[priceId]) || (productId && PLAN_MAP[productId]);
  if (hit) return hit;
  // Fallback: metadata set at checkout
  const plan = sub?.metadata?.plan ?? null;
  const interval = sub?.metadata?.interval ?? null;
  return {
    plan: ["solo", "team", "brokerage"].includes(plan) ? plan : null,
    interval: ["monthly", "annual"].includes(interval) ? interval : null,
  };
}

Deno.serve(async (req: Request) => {
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
  const signature = req.headers.get("Stripe-Signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, Deno.env.get("STRIPE_WEBHOOK_SECRET")!);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed:", String(err));
    return new Response(`Webhook signature verification failed: ${err}`, { status: 400 });
  }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Throw on any DB error so we return 500 and Stripe retries.
  // deno-lint-ignore no-explicit-any
  const must = (res: { error: any }, what: string) => {
    if (res.error) throw new Error(`${what}: ${res.error.message}`);
  };

  // deno-lint-ignore no-explicit-any
  async function resolveOrgId(sub: any, fallback?: string | null): Promise<string | null> {
    const fromMeta = sub?.metadata?.org_id ?? fallback ?? null;
    if (fromMeta) return fromMeta;
    const customerId = typeof sub?.customer === "string" ? sub.customer : sub?.customer?.id;
    if (!customerId) return null;
    const res = await db.from("organizations").select("id").eq("stripe_customer_id", customerId).maybeSingle();
    must(res, "lookup org by customer");
    return res.data?.id ?? null;
  }

  // Drop the org back to 'trial' unless another subscription is still live.
  async function dropToTrialIfNoOtherLiveSub(orgId: string, subId: string) {
    const other = await db.from("subscriptions").select("id")
      .eq("org_id", orgId).in("status", ACTIVE_STATUSES).neq("stripe_subscription_id", subId).limit(1);
    must(other, "check other subscriptions");
    if (!other.data?.length) {
      must(await db.from("organizations").update({ plan: "trial" }).eq("id", orgId), "reset org plan");
    }
  }

  // deno-lint-ignore no-explicit-any
  async function syncSubscription(sub: any, orgIdHint?: string | null) {
    const orgId = await resolveOrgId(sub, orgIdHint);
    if (!orgId) throw new Error(`No org found for subscription ${sub.id}`);
    const { plan, interval } = planFromSub(sub);
    if (!plan) throw new Error(`Cannot determine plan for subscription ${sub.id} (price/product not in PLAN_MAP and no metadata)`);

    must(
      await db.from("subscriptions").upsert(
        {
          org_id: orgId,
          stripe_subscription_id: sub.id,
          status: sub.status,
          plan,
          billing_interval: interval,
          current_period_end: periodEnd(sub),
          cancel_at_period_end: !!sub.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "stripe_subscription_id" },
      ),
      "upsert subscription",
    );

    if (ACTIVE_STATUSES.includes(sub.status)) {
      if (sub.cancel_at_period_end) {
        must(await db.from("organizations").update({ plan }).eq("id", orgId), "update org plan");
        // Cancellation scheduled (from the app or the Stripe portal): record when, once.
        must(
          await db.from("organizations").update({ cancel_requested_at: new Date().toISOString() })
            .eq("id", orgId).is("cancel_requested_at", null),
          "set cancel_requested_at",
        );
      } else {
        // Active and not cancelling: clear any old cancellation request (e.g. resumed in the portal).
        must(await db.from("organizations").update({ plan, cancel_requested_at: null }).eq("id", orgId), "update org plan");
      }
    } else if (LOST_STATUSES.includes(sub.status)) {
      await dropToTrialIfNoOtherLiveSub(orgId, sub.id);
    }
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription" || !session.subscription) break;
        const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        const sub = await stripe.subscriptions.retrieve(subId);
        await syncSubscription(sub, session.metadata?.org_id ?? null);
        break;
      }
      case "customer.subscription.updated": {
        await syncSubscription(event.data.object);
        break;
      }
      case "customer.subscription.deleted": {
        // deno-lint-ignore no-explicit-any
        const sub = event.data.object as any;
        must(
          await db.from("subscriptions").update({
            status: "canceled",
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          }).eq("stripe_subscription_id", sub.id),
          "mark subscription canceled",
        );
        const orgId = await resolveOrgId(sub);
        if (orgId) await dropToTrialIfNoOtherLiveSub(orgId, sub.id);
        break;
      }
    }
  } catch (e) {
    console.error(`[stripe-webhook] ${event.type} ${event.id}:`, e);
    return json({ error: String(e) }, 500);
  }

  return json({ received: true });
});
