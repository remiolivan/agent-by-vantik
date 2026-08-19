import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const { eventId } = await req.json();
    if (!eventId) {
      return new Response(JSON.stringify({ error: "eventId is required" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: membership } = await adminClient.from("memberships").select("id, org_id").eq("user_id", user.id).eq("status", "active").maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "No active membership" }), { status: 403, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const { data: event, error: eventErr } = await adminClient
      .from("calendar_events")
      .select("*, contacts(name, email), properties(title, address, contact_id, contacts(name, email))")
      .eq("id", eventId).eq("org_id", membership.org_id).single();
    if (eventErr || !event) {
      return new Response(JSON.stringify({ error: "Event not found" }), { status: 404, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const { data: org } = await adminClient.from("organizations").select("name").eq("id", membership.org_id).single();

    // Collect distinct recipients from the linked prospect and the linked
    // property's own contact — dedup by email in case they're the same person.
    const recipients = new Map<string, string>();
    if (event.contacts?.email) recipients.set(event.contacts.email, event.contacts.name);
    if (event.properties?.contacts?.email) recipients.set(event.properties.contacts.email, event.properties.contacts.name);

    if (recipients.size === 0) {
      return new Response(JSON.stringify({ error: "No linked contact has an email address" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(JSON.stringify({ error: "Email sending is not configured" }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const start = new Date(event.start_at);
    const end = new Date(event.end_at);
    const dateStr = start.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const timeStr = `${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    const orgName = org?.name ?? "Agent by Vantik";

    let sent = 0;
    const errors: string[] = [];
    for (const [email, name] of recipients) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "alerts@getvantik.com",
            to: email,
            subject: `Invite: ${event.title}`,
            html: `
              <p>Hi ${name || ""},</p>
              <p>You're invited to <strong>${event.title}</strong>.</p>
              <p>${dateStr}<br/>${timeStr}${event.location ? `<br/>${event.location}` : ""}</p>
              <p style="color:#6B7280;font-size:12px;margin-top:24px;">Sent by ${orgName} via Agent by Vantik</p>
            `,
          }),
        });
        if (!res.ok) errors.push(`${email}: ${await res.text()}`);
        else sent++;
      } catch (e) {
        errors.push(`${email}: ${String(e)}`);
      }
    }

    return new Response(JSON.stringify({ success: true, sent, errors }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
