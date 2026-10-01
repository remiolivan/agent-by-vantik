import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Lifecycle emails for Agent by Vantik (customer journey, phases 1-2 + cancellation).
//
// Called by:
//   - pg_cron every 15 min (no body) -> sweeps every org
//   - stripe-webhook after a successful sync ({ org_id }) -> immediate send for that org
// Auth: x-cron-secret header (same secret as the other cron functions).
//
// Idempotency: every email is claimed by inserting (org_id, email_key) into
// public.email_log (unique). If the insert conflicts, the email was already
// sent (or is being sent by a concurrent run). If Resend fails, the claim is
// deleted so the next run retries, and the failure goes to app_errors.
//
// Every rule below also has a time window so a cron outage never sends stale
// emails days later (e.g. a "trial ends in 48h" after the trial has ended).

const APP_URL = "https://agent.getvantik.com";
const FROM = "Agent by Vantik <alerts@getvantik.com>";
const REPLY_TO = "remi.olivan@getvantik.com";
const LOGO_URL = `${APP_URL}/pwa-192x192.png`;
const TZ = "Asia/Dubai";

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const ACTIVE_STATUSES = ["active", "trialing", "past_due"];
const PLAN_LABEL: Record<string, string> = { solo: "Solo", team: "Team", brokerage: "Brokerage" };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: TZ });
}

type Email = { key: string; subject: string; heading: string; paragraphs: string[]; cta?: { label: string; url: string }; footnote?: string };

// Direction A: paper background, white card, navy header with the mark,
// one amber button (ink text), Poppins titles / Libre Franklin body.
function renderHtml(e: Email): string {
  const body = e.paragraphs
    .map((p) => `<p style="margin:0 0 16px;font-family:'Libre Franklin',Helvetica,Arial,sans-serif;font-size:15px;line-height:24px;color:#1C1B19;">${p}</p>`)
    .join("");
  const cta = e.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 8px;"><tr><td style="background:#E8963C;border-radius:6px;">
         <a href="${e.cta.url}" style="display:inline-block;padding:12px 22px;font-family:'Poppins',Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#1C1B19;text-decoration:none;">${esc(e.cta.label)}</a>
       </td></tr></table>`
    : "";
  const footnote = e.footnote
    ? `<p style="margin:24px 0 0;font-family:'Libre Franklin',Helvetica,Arial,sans-serif;font-size:13px;line-height:20px;color:#6B7280;">${e.footnote}</p>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F7F5F0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F5F0;"><tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E3DFD3;border-radius:6px;overflow:hidden;">
    <tr><td style="background:#16213E;padding:16px 28px;"><img src="${LOGO_URL}" width="40" height="40" alt="Agent by Vantik" style="display:block;border:0;"></td></tr>
    <tr><td style="padding:32px 28px 28px;">
      <h1 style="margin:0 0 20px;font-family:'Poppins',Helvetica,Arial,sans-serif;font-size:22px;line-height:30px;font-weight:600;color:#16213E;">${esc(e.heading)}</h1>
      ${body}${cta}${footnote}
    </td></tr>
  </table>
  <p style="margin:20px 0 0;font-family:'IBM Plex Mono',Menlo,monospace;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#6B7280;">Agent by Vantik · Vantik Apps Technology · Dubai</p>
</td></tr></table></body></html>`;
}

function renderText(e: Email): string {
  const strip = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return [e.heading, "", ...e.paragraphs.map(strip), e.cta ? `${e.cta.label}: ${e.cta.url}` : "", e.footnote ? strip(e.footnote) : "", "", "Agent by Vantik · Vantik Apps Technology · Dubai"]
    .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
    .join("\n");
}

Deno.serve(async (req: Request) => {
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) return json({ error: "Unauthorized" }, 401);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const resendKey = Deno.env.get("RESEND_API_KEY");

  async function logAppError(orgId: string | null, message: string, details: Record<string, unknown> = {}) {
    try {
      await db.from("app_errors").insert({ org_id: orgId, edge_function: "lifecycle-emails", message, details });
    } catch { /* never break the run because logging failed */ }
  }

  if (!resendKey) {
    await logAppError(null, "Email sending is not configured (missing RESEND_API_KEY)");
    return json({ error: "RESEND_API_KEY missing" }, 500);
  }

  let onlyOrgId: string | null = null;
  try {
    const b = await req.json();
    if (b && typeof b.org_id === "string") onlyOrgId = b.org_id;
  } catch { /* cron calls have no body */ }

  let q = db.from("organizations")
    .select("id, name, plan, created_at, trial_ends_at, is_comped, suspended_at")
    .eq("is_comped", false)
    .is("suspended_at", null);
  if (onlyOrgId) q = q.eq("id", onlyOrgId);
  const { data: orgs, error: orgErr } = await q;
  if (orgErr) {
    await logAppError(onlyOrgId, `Failed to load orgs: ${orgErr.message}`);
    return json({ error: orgErr.message }, 500);
  }

  const now = Date.now();
  let sent = 0;
  const errors: string[] = [];

  async function send(orgId: string, to: string, e: Email): Promise<void> {
    // 1. Claim
    const claim = await db.from("email_log").insert({ org_id: orgId, email_key: e.key, recipient: to }).select("id").single();
    if (claim.error) {
      if (claim.error.code === "23505") return; // already sent / in flight
      throw new Error(`claim ${e.key}: ${claim.error.message}`);
    }
    // 2. Send
    let ok = false, detail = "";
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json", "Idempotency-Key": `${orgId}:${e.key}` },
        body: JSON.stringify({ from: FROM, to, reply_to: REPLY_TO, subject: e.subject, html: renderHtml(e), text: renderText(e) }),
      });
      detail = await res.text();
      ok = res.ok;
      if (ok) {
        let resendId: string | null = null;
        try { resendId = JSON.parse(detail)?.id ?? null; } catch { /* ignore */ }
        await db.from("email_log").update({ sent_at: new Date().toISOString(), resend_id: resendId }).eq("id", claim.data.id);
        sent++;
        return;
      }
    } catch (err) {
      detail = String(err);
    }
    // 3. Release the claim so the next run retries
    await db.from("email_log").delete().eq("id", claim.data.id);
    throw new Error(`resend ${e.key}: ${detail}`);
  }

  for (const org of orgs ?? []) {
    try {
      const { data: owner } = await db.from("memberships").select("user_id")
        .eq("org_id", org.id).eq("role", "owner").eq("status", "active").not("user_id", "is", null)
        .order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (!owner?.user_id) continue;
      const { data: u } = await db.auth.admin.getUserById(owner.user_id);
      const user = u?.user;
      if (!user?.email || !user.email_confirmed_at) continue; // J0 waits for the confirmation click

      const [{ data: subs }, { data: logRows }] = await Promise.all([
        db.from("subscriptions").select("stripe_subscription_id, status, plan, billing_interval, current_period_end, cancel_at_period_end, created_at").eq("org_id", org.id),
        db.from("email_log").select("email_key, sent_at").eq("org_id", org.id),
      ]);
      const logged = new Map((logRows ?? []).map((r) => [r.email_key, r.sent_at as string | null]));
      const orgName = esc(org.name);
      const created = new Date(org.created_at).getTime();
      const trialEnd = org.trial_ends_at ? new Date(org.trial_ends_at).getTime() : null;
      const isTrial = org.plan === "trial" && (subs ?? []).length === 0; // never send trial emails to anyone who has paid
      const due: Email[] = [];

      // ---- Phase 1: activation
      if (now - created < 7 * DAY && !logged.has("welcome")) {
        due.push({
          key: "welcome",
          subject: "Welcome to Agent by Vantik",
          heading: "Your workspace is ready",
          paragraphs: [
            `<strong>${orgName}</strong> is set up and waiting for you.`,
            "First step: add your first contact and watch your pipeline come to life in 30 seconds.",
          ],
          cta: { label: "Add a contact", url: `${APP_URL}/prospects` },
          footnote: isTrial && trialEnd
            ? `Your free trial runs until ${fmtDate(org.trial_ends_at)}. No card needed. Questions? Just reply to this email.`
            : "Questions? Just reply to this email.",
        });
      }

      const welcomeAt = logged.get("welcome");
      if (isTrial && now - created >= DAY && now - created < 3 * DAY && !logged.has("day1_empty_pipeline")
          && welcomeAt && now - new Date(welcomeAt).getTime() >= 12 * HOUR) {
        const { count } = await db.from("contacts").select("id", { count: "exact", head: true }).eq("org_id", org.id);
        if (!count) {
          due.push({
            key: "day1_empty_pipeline",
            subject: "Your pipeline is empty — 2 minutes to fix that",
            heading: "Your pipeline is still empty",
            paragraphs: [
              "You haven't added a contact yet. Import your existing list as a CSV, or add one manually to see how tracking works.",
            ],
            cta: { label: "Import my contacts", url: `${APP_URL}/prospects` },
          });
        }
      }

      // ---- Phase 2: trial -> paying (windows are mutually exclusive)
      if (isTrial && trialEnd) {
        if (now >= trialEnd - 7 * DAY && now < trialEnd - 2 * DAY && now - created >= 5 * DAY && !logged.has("trial_midpoint")) {
          const [c, p, t] = await Promise.all([
            db.from("contacts").select("id", { count: "exact", head: true }).eq("org_id", org.id),
            db.from("properties").select("id", { count: "exact", head: true }).eq("org_id", org.id),
            db.from("tasks").select("id", { count: "exact", head: true }).eq("org_id", org.id).not("completed_at", "is", null),
          ]);
          const daysLeft = Math.ceil((trialEnd - now) / DAY);
          const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
          const hasActivity = (c.count ?? 0) + (p.count ?? 0) + (t.count ?? 0) > 0;
          due.push({
            key: "trial_midpoint",
            subject: hasActivity ? "What you've already gotten done this week" : "Halfway through your trial",
            heading: hasActivity ? "Here's your week in Agent" : "Your trial is halfway through",
            paragraphs: [
              hasActivity
                ? `So far: ${plural(c.count ?? 0, "contact")} added, ${plural(p.count ?? 0, "property", "properties")} tracked, ${plural(t.count ?? 0, "task")} completed.`
                : "You haven't added anything yet. It takes a minute to add your first contact and see how Agent keeps your follow-ups on track.",
              `You've got ${plural(daysLeft, "day")} left on your trial. Solo starts at AED 99/month, or AED 999/year (2 months free).`,
            ],
            cta: { label: "See plans", url: `${APP_URL}/billing` },
          });
        } else if (now >= trialEnd - 2 * DAY && now < trialEnd && !logged.has("trial_ending_48h")) {
          due.push({
            key: "trial_ending_48h",
            subject: "Your trial ends in 48 hours",
            heading: "Your trial ends in 48 hours",
            paragraphs: [
              `Your free trial ends on ${fmtDate(org.trial_ends_at)}. After that, access to your workspace is paused until you pick a plan. Your data is kept.`,
              "Solo starts at AED 99/month.",
            ],
            cta: { label: "Continue with Agent", url: `${APP_URL}/billing` },
          });
        } else if (now >= trialEnd && now < trialEnd + 3 * DAY && !logged.has("trial_ended")) {
          due.push({
            key: "trial_ended",
            subject: "Your trial has ended",
            heading: "Your trial has ended",
            paragraphs: [
              "Access to your workspace is paused. Your data is untouched: pick a plan to unlock everything again.",
            ],
            cta: { label: "Reactivate my account", url: `${APP_URL}/billing` },
          });
        }
      }

      // ---- Payment confirmed / cancellation confirmed (one per subscription)
      for (const s of subs ?? []) {
        const plan = PLAN_LABEL[s.plan] ?? "Agent";
        const subCreated = new Date(s.created_at).getTime();
        const payKey = `payment_confirmed:${s.stripe_subscription_id}`;
        if (["active", "trialing"].includes(s.status) && now - subCreated < 7 * DAY && !logged.has(payKey)) {
          due.push({
            key: payKey,
            subject: "Payment confirmed — welcome to Agent",
            heading: `Your ${plan} plan is active`,
            paragraphs: [
              `Thanks for subscribing. <strong>${orgName}</strong> is fully unlocked on the ${plan} plan${s.billing_interval === "annual" ? " (billed yearly)" : s.billing_interval === "monthly" ? " (billed monthly)" : ""}.`,
              "Your receipt was sent in a separate email by Stripe. You can find all your invoices and manage your subscription from the Billing page.",
            ],
            cta: { label: "Open Agent", url: `${APP_URL}/` },
            footnote: `Invoices and payment method: <a href="${APP_URL}/billing" style="color:#4C7BC9;">Billing</a>. Questions? Just reply to this email.`,
          });
        }

        const cancelKey = `cancellation_confirmed:${s.stripe_subscription_id}`;
        const periodEnd = s.current_period_end ? new Date(s.current_period_end).getTime() : null;
        if (s.cancel_at_period_end && ACTIVE_STATUSES.includes(s.status) && periodEnd && periodEnd > now && !logged.has(cancelKey)) {
          due.push({
            key: cancelKey,
            subject: "Your subscription has been cancelled",
            heading: "Your subscription is cancelled",
            paragraphs: [
              `Your ${plan} plan stays active until ${fmtDate(s.current_period_end)}. You won't be charged again.`,
              "One last question, in a sentence: what could have made you stay? Just reply to this email, I read every answer.",
            ],
            footnote: `Changed your mind? You can resume anytime before that date from <a href="${APP_URL}/billing" style="color:#4C7BC9;">Billing</a>.`,
          });
        }
      }

      for (const e of due) {
        try {
          await send(org.id, user.email, e);
        } catch (err) {
          errors.push(`${org.id} ${e.key}: ${String(err)}`);
          await logAppError(org.id, `Lifecycle email failed: ${e.key}`, { error: String(err) });
        }
      }
    } catch (err) {
      errors.push(`${org.id}: ${String(err)}`);
      await logAppError(org.id, "Lifecycle email run failed for org", { error: String(err) });
    }
  }

  return json({ orgs: orgs?.length ?? 0, sent, errors });
});
