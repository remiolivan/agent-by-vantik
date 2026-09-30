import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// Keep in sync with src/lib/pricing.js (validated 24/09/2026). Only used to
// estimate MRR in the metrics view — never touches Stripe. Annual plans count
// as annual price / 12. Brokerage is quote-based: counted at its "from" price.
const PLAN_PRICES_AED: Record<string, { monthly: number; annual: number }> = {
  solo: { monthly: 99, annual: 999 },
  team: { monthly: 349, annual: 3499 },
  brokerage: { monthly: 899, annual: 899 * 12 },
};
const AED_PER_USD = 3.6725; // fixed peg
const VALID_PLANS = ["trial", "solo", "team", "brokerage"];
const LIVE_SUB_STATUSES = ["active", "trialing", "past_due"];

// An org can have several subscription rows (e.g. an old canceled one and a
// new active one). Live ones first, then most recently updated.
// deno-lint-ignore no-explicit-any
function sortSubs(subs: any): any[] {
  const arr = Array.isArray(subs) ? [...subs] : subs ? [subs] : [];
  const ts = (s: any) => new Date(s.updated_at ?? s.created_at ?? 0).getTime();
  return arr.sort((a, b) => {
    const la = LIVE_SUB_STATUSES.includes(a.status) ? 1 : 0;
    const lb = LIVE_SUB_STATUSES.includes(b.status) ? 1 : 0;
    if (la !== lb) return lb - la;
    return ts(b) - ts(a);
  });
}
// deno-lint-ignore no-explicit-any
const pickSub = (subs: any) => sortSubs(subs)[0] ?? null;

// deno-lint-ignore no-explicit-any
function monthlyValueAed(plan: string, sub: any): number {
  const prices = PLAN_PRICES_AED[sub?.plan ?? plan];
  if (!prices) return 0;
  return sub?.billing_interval === "annual" ? prices.annual / 12 : prices.monthly;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";

    // Scoped to the caller's own JWT — used only to identify who is calling.
    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !user) {
      return json({ error: "Not authenticated" }, 401);
    }

    // Service-role client — bypasses RLS, used for every admin read/write.
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Gate: caller must be in platform_admins. This table has no RLS
    // policies for anon/authenticated, so only this service-role check
    // can ever read it — a stolen user JWT alone can't self-promote.
    const { data: staffRow } = await adminClient
      .from("platform_admins")
      .select("user_id, email")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!staffRow) {
      return json({ error: "Not authorized for the admin panel" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    async function logAction(
      actionName: string,
      targetOrgId: string | null,
      targetMembershipId: string | null,
      details: Record<string, unknown>
    ) {
      await adminClient.from("admin_actions_log").insert({
        admin_user_id: user.id,
        admin_email: staffRow.email,
        action: actionName,
        target_org_id: targetOrgId,
        target_membership_id: targetMembershipId,
        details,
      });
    }

    switch (action) {
      // ---------------------------------------------------------------
      case "whoami": {
        return json({ isAdmin: true, email: staffRow.email });
      }

      // ---------------------------------------------------------------
      case "list_orgs": {
        const search = String(body.search ?? "").trim();
        const planFilter = body.plan ?? null;
        const page = Math.max(1, Number(body.page) || 1);
        const pageSize = Math.min(100, Math.max(1, Number(body.pageSize) || 25));
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = adminClient
          .from("organizations")
          .select(
            "id, name, plan, is_comped, trial_ends_at, created_at, suspended_at, suspended_reason, stripe_customer_id, subscriptions(status, plan, billing_interval, current_period_end, cancel_at_period_end, created_at, updated_at), memberships(count)",
            { count: "exact" }
          )
          .order("created_at", { ascending: false })
          .range(from, to);

        if (search) query = query.ilike("name", `%${search}%`);
        if (planFilter && VALID_PLANS.includes(planFilter)) query = query.eq("plan", planFilter);

        const { data, error, count } = await query;
        if (error) return json({ error: error.message }, 500);

        const now = Date.now();
        // deno-lint-ignore no-explicit-any
        const orgs = (data ?? []).map((o: any) => {
          const sub = pickSub(o.subscriptions);
          let status: string;
          if (o.suspended_at) status = "suspended";
          else if (o.is_comped) status = "comped";
          else if (sub?.status === "active") status = "active";
          else if (sub?.status) status = sub.status;
          else if (o.trial_ends_at && new Date(o.trial_ends_at).getTime() > now) status = "trialing";
          else status = "trial_expired";

          return {
            id: o.id,
            name: o.name,
            plan: o.plan,
            status,
            isComped: o.is_comped,
            trialEndsAt: o.trial_ends_at,
            createdAt: o.created_at,
            suspendedAt: o.suspended_at,
            suspendedReason: o.suspended_reason,
            hasStripeCustomer: !!o.stripe_customer_id,
            memberCount: o.memberships?.[0]?.count ?? 0,
            subscription: sub,
          };
        });

        return json({ orgs, total: count ?? 0, page, pageSize });
      }

      // ---------------------------------------------------------------
      case "get_org": {
        const orgId = body.orgId;
        if (!orgId) return json({ error: "orgId is required" }, 400);

        const { data: org, error: orgErr } = await adminClient
          .from("organizations")
          .select("*, subscriptions(*)")
          .eq("id", orgId)
          .maybeSingle();
        if (orgErr) return json({ error: orgErr.message }, 500);
        if (!org) return json({ error: "Organization not found" }, 404);
        // Front reads subscriptions[0]: make sure it's the current one.
        org.subscriptions = sortSubs(org.subscriptions);

        const { data: members, error: membersErr } = await adminClient.rpc("admin_org_members", {
          p_org_id: orgId,
        });
        if (membersErr) return json({ error: membersErr.message }, 500);

        const [
          { count: contactsCount },
          { count: propertiesCount },
          { count: documentsCount },
          { count: tasksCount },
        ] = await Promise.all([
          adminClient.from("contacts").select("id", { count: "exact", head: true }).eq("org_id", orgId),
          adminClient.from("properties").select("id", { count: "exact", head: true }).eq("org_id", orgId),
          adminClient.from("documents").select("id", { count: "exact", head: true }).eq("org_id", orgId),
          adminClient.from("tasks").select("id", { count: "exact", head: true }).eq("org_id", orgId),
        ]);

        const { data: recentActivity } = await adminClient
          .from("admin_actions_log")
          .select("*")
          .eq("target_org_id", orgId)
          .order("created_at", { ascending: false })
          .limit(20);

        return json({
          org,
          members: members ?? [],
          counts: {
            contacts: contactsCount ?? 0,
            properties: propertiesCount ?? 0,
            documents: documentsCount ?? 0,
            tasks: tasksCount ?? 0,
          },
          recentActivity: recentActivity ?? [],
        });
      }

      // ---------------------------------------------------------------
      case "extend_trial": {
        const { orgId, days } = body;
        if (!orgId || !days || Number(days) <= 0) {
          return json({ error: "orgId and a positive number of days are required" }, 400);
        }
        const { data: current, error: fetchErr } = await adminClient
          .from("organizations")
          .select("trial_ends_at")
          .eq("id", orgId)
          .maybeSingle();
        if (fetchErr || !current) return json({ error: fetchErr?.message ?? "Organization not found" }, 404);

        const base = current.trial_ends_at && new Date(current.trial_ends_at).getTime() > Date.now()
          ? new Date(current.trial_ends_at)
          : new Date();
        const newTrialEnd = new Date(base.getTime() + Number(days) * 24 * 60 * 60 * 1000);

        const { error: updateErr } = await adminClient
          .from("organizations")
          .update({ trial_ends_at: newTrialEnd.toISOString() })
          .eq("id", orgId);
        if (updateErr) return json({ error: updateErr.message }, 500);

        await logAction("extend_trial", orgId, null, { days: Number(days), newTrialEnd: newTrialEnd.toISOString() });
        return json({ success: true, trialEndsAt: newTrialEnd.toISOString() });
      }

      // ---------------------------------------------------------------
      case "set_plan": {
        const { orgId, plan } = body;
        if (!orgId || !VALID_PLANS.includes(plan)) {
          return json({ error: `plan must be one of: ${VALID_PLANS.join(", ")}` }, 400);
        }
        const { error: updateErr } = await adminClient
          .from("organizations")
          .update({ plan })
          .eq("id", orgId);
        if (updateErr) return json({ error: updateErr.message }, 500);

        await logAction("set_plan", orgId, null, {
          plan,
          note: "This updates the organizations.plan label only — it does NOT change Stripe. Use the Stripe dashboard or create-checkout-session for real plan/billing changes.",
        });
        return json({ success: true });
      }

      // ---------------------------------------------------------------
      case "set_comped": {
        const { orgId, isComped } = body;
        if (!orgId || typeof isComped !== "boolean") {
          return json({ error: "orgId and isComped (boolean) are required" }, 400);
        }
        const { error: updateErr } = await adminClient
          .from("organizations")
          .update({ is_comped: isComped })
          .eq("id", orgId);
        if (updateErr) return json({ error: updateErr.message }, 500);

        await logAction(isComped ? "set_comped_on" : "set_comped_off", orgId, null, {});
        return json({ success: true });
      }

      // ---------------------------------------------------------------
      case "suspend_org": {
        const { orgId, reason } = body;
        if (!orgId || !reason || typeof reason !== "string" || !reason.trim()) {
          return json({ error: "orgId and a reason are required to suspend an org" }, 400);
        }
        const { error: updateErr } = await adminClient
          .from("organizations")
          .update({ suspended_at: new Date().toISOString(), suspended_reason: reason.trim(), suspended_by: user.id })
          .eq("id", orgId);
        if (updateErr) return json({ error: updateErr.message }, 500);

        await logAction("suspend_org", orgId, null, { reason: reason.trim() });
        return json({ success: true });
      }

      // ---------------------------------------------------------------
      case "unsuspend_org": {
        const { orgId } = body;
        if (!orgId) return json({ error: "orgId is required" }, 400);

        const { error: updateErr } = await adminClient
          .from("organizations")
          .update({ suspended_at: null, suspended_reason: null, suspended_by: null })
          .eq("id", orgId);
        if (updateErr) return json({ error: updateErr.message }, 500);

        await logAction("unsuspend_org", orgId, null, {});
        return json({ success: true });
      }

      // ---------------------------------------------------------------
      case "resend_invite": {
        const { membershipId } = body;
        if (!membershipId) return json({ error: "membershipId is required" }, 400);

        const { data: membership, error: memErr } = await adminClient
          .from("memberships")
          .select("id, org_id, invited_email, status")
          .eq("id", membershipId)
          .maybeSingle();
        if (memErr || !membership) return json({ error: memErr?.message ?? "Membership not found" }, 404);
        if (membership.status !== "invited") {
          return json({ error: `This membership is '${membership.status}', not 'invited' — nothing to resend` }, 409);
        }
        if (!membership.invited_email) {
          return json({ error: "No invited_email on this membership" }, 400);
        }

        const { error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(membership.invited_email);
        if (inviteErr) return json({ error: inviteErr.message }, 500);

        await logAction("resend_invite", membership.org_id, membership.id, { email: membership.invited_email });
        return json({ success: true });
      }

      // ---------------------------------------------------------------
      case "get_invite_link": {
        const { membershipId } = body;
        if (!membershipId) return json({ error: "membershipId is required" }, 400);

        const { data: membership, error: memErr } = await adminClient
          .from("memberships")
          .select("id, org_id, invited_email, status")
          .eq("id", membershipId)
          .maybeSingle();
        if (memErr || !membership) return json({ error: memErr?.message ?? "Membership not found" }, 404);
        if (membership.status !== "invited") {
          return json({ error: `This membership is '${membership.status}', not 'invited'` }, 409);
        }
        if (!membership.invited_email) return json({ error: "No invited_email on this membership" }, 400);

        const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
          type: "invite",
          email: membership.invited_email,
        });
        if (linkErr) return json({ error: linkErr.message }, 500);

        await logAction("get_invite_link", membership.org_id, membership.id, { email: membership.invited_email });
        return json({ link: linkData?.properties?.action_link ?? null });
      }

      case "export_org_csv": {
        const { orgId, entity } = body;
        const ENTITY_COLUMNS: Record<string, string> = {
          contacts: "id, name, email, phone, type, source, intent, budget_min, budget_max, locations_wanted, created_at",
          properties: "id, title, address, property_type, status, listing_type, value, currency, bedrooms, bathrooms, owner_name, owner_phone, owner_email, created_at",
          documents: "id, type, title, invoice_number, total, currency, due_date, recipient_name, recipient_email, created_at",
          tasks: "id, title, due_at, completed_at, created_at",
        };
        if (!orgId || !entity || !ENTITY_COLUMNS[entity]) {
          return json({ error: `entity must be one of: ${Object.keys(ENTITY_COLUMNS).join(", ")}` }, 400);
        }
        const columns = ENTITY_COLUMNS[entity];
        const { data, error } = await adminClient
          .from(entity)
          .select(columns)
          .eq("org_id", orgId)
          .order("created_at", { ascending: false });
        if (error) return json({ error: error.message }, 500);

        const rows = (data ?? []) as Record<string, unknown>[];
        const headers = columns.split(",").map((c) => c.trim());
        const escapeCsv = (val: unknown) => {
          if (val === null || val === undefined) return "";
          const str = Array.isArray(val) ? val.join("; ") : String(val);
          return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
        };
        const csvLines = [headers.join(",")];
        for (const row of rows) {
          csvLines.push(headers.map((h) => escapeCsv(row[h])).join(","));
        }
        const csv = csvLines.join("\n");

        await logAction("export_org_csv", orgId, null, { entity, rowCount: rows.length });
        return json({ csv, filename: `${entity}-${orgId}.csv`, rowCount: rows.length });
      }

      case "ai_diagnose": {
        const { orgId, problem } = body;
        if (!orgId || !problem || typeof problem !== "string" || !problem.trim()) {
          return json({ error: "orgId and a problem description are required" }, 400);
        }

        const { data: org } = await adminClient.from("organizations").select("*, subscriptions(*)").eq("id", orgId).maybeSingle();
        if (!org) return json({ error: "Organization not found" }, 404);

        const { data: members } = await adminClient.rpc("admin_org_members", { p_org_id: orgId });
        const { data: recentActivity } = await adminClient
          .from("admin_actions_log")
          .select("action, details, created_at")
          .eq("target_org_id", orgId)
          .order("created_at", { ascending: false })
          .limit(10);

        const sub = pickSub(org.subscriptions);
        const contextParts = [
          `Organization: ${org.name}`,
          `Plan: ${org.plan}`,
          `Comped: ${org.is_comped}`,
          `Suspended: ${org.suspended_at ? `yes (${org.suspended_reason})` : "no"}`,
          `Trial ends: ${org.trial_ends_at ?? "n/a"}`,
          `Subscription status: ${sub?.status ?? "none"}${sub?.billing_interval ? ` (${sub.billing_interval})` : ""}${sub?.cancel_at_period_end ? ", cancels at period end" : ""}`,
          `Stripe customer linked: ${org.stripe_customer_id ? "yes" : "no"}`,
          `Access rule: an org has access if comped, on a paid plan, or its trial hasn't ended; otherwise owners are sent to /billing.`,
          // deno-lint-ignore no-explicit-any
          `Members: ${(members ?? []).map((m: any) => `${m.email} (${m.role}, ${m.status})`).join("; ") || "none"}`,
          // deno-lint-ignore no-explicit-any
          `Recent admin actions on this org: ${(recentActivity ?? []).map((a: any) => `${a.action} at ${a.created_at}`).join("; ") || "none"}`,
        ].join("\n");

        const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
        if (!apiKey) {
          return json({ error: "AI assistant isn't configured yet (missing ANTHROPIC_API_KEY)." }, 500);
        }

        const prompt = `You are a support copilot for "Agent by Vantik", a real estate CRM SaaS. The founder (Remi) is troubleshooting a client issue and needs a diagnosis and concrete next steps. Be specific and actionable, referencing the org data given. If the described problem could plausibly be caused by something in the org data below, say so explicitly. If it's more likely a bug/frontend issue that can't be explained from this data, say that too rather than guessing. Keep the response under 200 words, structured as: likely cause, then recommended action(s).\n\nOrg data:\n${contextParts}\n\nProblem described by the founder:\n${problem.trim()}`;

        const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 500,
            thinking: { type: "disabled" },
            messages: [{ role: "user", content: prompt }],
          }),
        });

        if (!aiRes.ok) {
          const errText = await aiRes.text();
          return json({ error: `AI request failed: ${errText}` }, 502);
        }
        const aiData = await aiRes.json();
        const diagnosis = (aiData.content ?? [])
          .filter((b: { type: string }) => b.type === "text")
          .map((b: { text: string }) => b.text)
          .join("\n")
          .trim();

        await logAction("ai_diagnose", orgId, null, { problem: problem.trim() });
        return json({ diagnosis });
      }

      case "get_org_storage_usage": {
        const orgId = body.orgId;
        if (!orgId) return json({ error: "orgId is required" }, 400);

        const { data, error } = await adminClient.rpc("admin_org_storage_usage", { p_org_id: orgId });
        if (error) return json({ error: error.message }, 500);

        const byBucket = (data ?? []) as { bucket_id: string; total_bytes: number; file_count: number }[];
        const totalBytes = byBucket.reduce((sum, b) => sum + Number(b.total_bytes), 0);
        const totalFiles = byBucket.reduce((sum, b) => sum + Number(b.file_count), 0);

        return json({ byBucket, totalBytes, totalFiles });
      }

      case "list_org_errors": {
        const orgId = body.orgId;
        if (!orgId) return json({ error: "orgId is required" }, 400);
        const page = Math.max(1, Number(body.page) || 1);
        const pageSize = Math.min(100, Math.max(1, Number(body.pageSize) || 20));
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        const { data, error, count } = await adminClient
          .from("app_errors")
          .select("*", { count: "exact" })
          .eq("org_id", orgId)
          .order("created_at", { ascending: false })
          .range(from, to);
        if (error) return json({ error: error.message }, 500);
        return json({ errors: data ?? [], total: count ?? 0, page, pageSize });
      }

      case "reset_password": {
        const { email } = body;
        if (!email || typeof email !== "string") return json({ error: "email is required" }, 400);

        const redirectTo = Deno.env.get("ADMIN_RESET_REDIRECT_URL") ?? "https://agent.getvantik.com/reset-password";
        const { error: resetErr } = await callerClient.auth.resetPasswordForEmail(email, { redirectTo });
        if (resetErr) return json({ error: resetErr.message }, 500);

        await logAction("reset_password", null, null, { email });
        return json({ success: true });
      }

      // ---------------------------------------------------------------
      case "list_users": {
        const search = String(body.search ?? "").trim();
        const { data, error } = await adminClient.rpc("admin_search_members", { search });
        if (error) return json({ error: error.message }, 500);
        return json({ users: data ?? [] });
      }

      // ---------------------------------------------------------------
      case "list_activity": {
        const orgId = body.orgId ?? null;
        const page = Math.max(1, Number(body.page) || 1);
        const pageSize = Math.min(100, Math.max(1, Number(body.pageSize) || 30));
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = adminClient
          .from("admin_actions_log")
          .select("*", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(from, to);
        if (orgId) query = query.eq("target_org_id", orgId);

        const { data, error, count } = await query;
        if (error) return json({ error: error.message }, 500);
        return json({ entries: data ?? [], total: count ?? 0, page, pageSize });
      }

      // ---------------------------------------------------------------
      case "trigger_reminders": {
        const target = body.target;
        const VALID_TARGETS = ["send-reminders", "send-due-reminders"];
        if (!VALID_TARGETS.includes(target)) {
          return json({ error: `target must be one of: ${VALID_TARGETS.join(", ")}` }, 400);
        }

        const cronSecret = Deno.env.get("CRON_SECRET");
        if (!cronSecret) {
          return json({ error: "CRON_SECRET is not configured as a project secret" }, 500);
        }

        const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/${target}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "x-cron-secret": cronSecret, "Content-Type": "application/json" },
        });
        const rawText = await res.text();
        let result: unknown;
        try {
          result = JSON.parse(rawText);
        } catch {
          result = { raw: rawText };
        }

        await logAction("trigger_reminders", null, null, { target, status: res.status, result });
        return json({ success: res.ok, status: res.status, result });
      }

      // ---------------------------------------------------------------
      case "metrics": {
        const { data: orgs, error: orgsErr } = await adminClient
          .from("organizations")
          .select("id, plan, is_comped, suspended_at, trial_ends_at, created_at, subscriptions(status, plan, billing_interval, created_at, updated_at)");
        if (orgsErr) return json({ error: orgsErr.message }, 500);

        const now = Date.now();
        const day = 24 * 60 * 60 * 1000;
        let active = 0, trialing = 0, trialExpired = 0, suspended = 0, comped = 0, canceled = 0;
        let mrrAed = 0;
        let signups7d = 0, signups30d = 0;
        let expiringSoon = 0;

        for (const o of orgs ?? []) {
          const sub = pickSub(o.subscriptions);
          const createdMs = new Date(o.created_at).getTime();
          if (now - createdMs <= 7 * day) signups7d++;
          if (now - createdMs <= 30 * day) signups30d++;

          if (o.suspended_at) {
            suspended++;
            continue;
          }
          if (o.is_comped) {
            comped++;
            continue;
          }
          if (sub && LIVE_SUB_STATUSES.includes(sub.status)) {
            active++;
            mrrAed += monthlyValueAed(o.plan, sub);
          } else if (sub?.status === "canceled") {
            canceled++;
          } else if (o.trial_ends_at && new Date(o.trial_ends_at).getTime() > now) {
            trialing++;
            if (new Date(o.trial_ends_at).getTime() - now <= 3 * day) expiringSoon++;
          } else {
            trialExpired++;
          }
        }

        mrrAed = Math.round(mrrAed);
        return json({
          totalOrgs: (orgs ?? []).length,
          active,
          trialing,
          trialExpired,
          suspended,
          comped,
          canceled,
          mrrAed,
          // Kept for the current admin dashboard until it switches to mrrAed.
          mrrUsd: Math.round(mrrAed / AED_PER_USD),
          signups7d,
          signups30d,
          trialsExpiringSoon: expiringSoon,
        });
      }

      // ---------------------------------------------------------------
      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
