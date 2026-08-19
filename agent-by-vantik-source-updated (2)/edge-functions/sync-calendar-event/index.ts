import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AGENT_FOOTER = "Created via Agent by Vantik";

async function refreshGoogleToken(refreshToken: string) {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || "Google token refresh failed");
  return data;
}

async function refreshOutlookToken(refreshToken: string) {
  const clientId = Deno.env.get("MS_CLIENT_ID")!;
  const clientSecret = Deno.env.get("MS_CLIENT_SECRET")!;
  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token", scope: "offline_access Calendars.ReadWrite User.Read" }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || "Outlook token refresh failed");
  return data;
}

async function ensureFreshToken(adminClient: any, connection: any): Promise<string> {
  const expiresAt = new Date(connection.token_expires_at).getTime();
  if (expiresAt - Date.now() > 60_000) return connection.access_token;

  const refreshed = connection.provider === "google"
    ? await refreshGoogleToken(connection.refresh_token)
    : await refreshOutlookToken(connection.refresh_token);

  const newExpiresAt = new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000).toISOString();
  await adminClient.from("calendar_connections").update({
    access_token: refreshed.access_token,
    token_expires_at: newExpiresAt,
    ...(refreshed.refresh_token ? { refresh_token: refreshed.refresh_token } : {}),
  }).eq("id", connection.id);

  return refreshed.access_token;
}

function descriptionWithFooter(ev: any) {
  const base = (ev.description || "").trim();
  return base ? `${base}\n\n${AGENT_FOOTER}` : AGENT_FOOTER;
}

function toGoogleEvent(ev: any) {
  return {
    summary: ev.title,
    description: descriptionWithFooter(ev),
    location: ev.location || undefined,
    start: ev.all_day ? { date: ev.start_at.slice(0, 10) } : { dateTime: ev.start_at },
    end: ev.all_day ? { date: ev.end_at.slice(0, 10) } : { dateTime: ev.end_at },
  };
}

function toOutlookEvent(ev: any) {
  return {
    subject: ev.title,
    body: { contentType: "text", content: descriptionWithFooter(ev) },
    location: ev.location ? { displayName: ev.location } : undefined,
    start: { dateTime: ev.start_at, timeZone: "UTC" },
    end: { dateTime: ev.end_at, timeZone: "UTC" },
    isAllDay: !!ev.all_day,
  };
}

// Pushes (or deletes) a single event against a single connection, updating
// its row in calendar_event_syncs. Returns true if the remote call succeeded.
async function syncOne(adminClient: any, event: any, connection: any, action: "create" | "update" | "delete"): Promise<{ ok: boolean; error?: string }> {
  let accessToken: string;
  try {
    accessToken = await ensureFreshToken(adminClient, connection);
  } catch (e) {
    await adminClient.from("calendar_event_syncs").update({ sync_status: "sync_error", sync_error: String(e), updated_at: new Date().toISOString() })
      .eq("event_id", event.id).eq("connection_id", connection.id);
    return { ok: false, error: String(e) };
  }

  const isGoogle = connection.provider === "google";
  const baseUrl = isGoogle
    ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendar_id)}/events`
    : `https://graph.microsoft.com/v1.0/me/events`;

  const { data: syncRow } = await adminClient.from("calendar_event_syncs").select("*")
    .eq("event_id", event.id).eq("connection_id", connection.id).maybeSingle();

  try {
    if (action === "delete") {
      if (syncRow?.external_event_id) {
        const res = await fetch(`${baseUrl}/${syncRow.external_event_id}`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
        if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`Remote delete failed (${res.status}): ${await res.text()}`);
      }
      await adminClient.from("calendar_event_syncs").delete().eq("event_id", event.id).eq("connection_id", connection.id);
      return { ok: true };
    }

    const body = isGoogle ? toGoogleEvent(event) : toOutlookEvent(event);
    let res: Response;
    if (!syncRow?.external_event_id) {
      res = await fetch(baseUrl, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } else {
      res = await fetch(`${baseUrl}/${syncRow.external_event_id}`, { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    }
    const resData = await res.json();
    if (!res.ok) throw new Error(`Remote ${action} failed (${res.status}): ${JSON.stringify(resData)}`);

    await adminClient.from("calendar_event_syncs").upsert({
      event_id: event.id,
      connection_id: connection.id,
      external_event_id: resData.id,
      sync_status: "synced",
      sync_error: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "event_id,connection_id" });

    return { ok: true };
  } catch (e) {
    await adminClient.from("calendar_event_syncs").upsert({
      event_id: event.id,
      connection_id: connection.id,
      sync_status: "sync_error",
      sync_error: String(e),
      updated_at: new Date().toISOString(),
    }, { onConflict: "event_id,connection_id" });
    return { ok: false, error: String(e) };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // connectionIds is optional and only used on "create" to select which
    // connections to push to. On update/delete we always act on whichever
    // connections the event is already synced to (from calendar_event_syncs).
    const { eventId, action, connectionIds } = await req.json();
    if (!eventId || !["create", "update", "delete"].includes(action)) {
      return new Response(JSON.stringify({ error: "eventId and a valid action are required" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: membership } = await adminClient.from("memberships").select("id, org_id").eq("user_id", user.id).eq("status", "active").maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "No active membership" }), { status: 403, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const { data: event, error: eventErr } = await adminClient.from("calendar_events").select("*").eq("id", eventId).eq("org_id", membership.org_id).maybeSingle();
    if (eventErr || !event) {
      return new Response(JSON.stringify({ error: "Event not found" }), { status: 404, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    let targetConnectionIds: string[] = [];
    if (action === "create" && Array.isArray(connectionIds) && connectionIds.length > 0) {
      targetConnectionIds = connectionIds;
    } else {
      const { data: existingSyncs } = await adminClient.from("calendar_event_syncs").select("connection_id").eq("event_id", eventId);
      targetConnectionIds = (existingSyncs ?? []).map((s: any) => s.connection_id);
    }

    if (targetConnectionIds.length === 0) {
      if (action === "delete") await adminClient.from("calendar_events").delete().eq("id", eventId);
      return new Response(JSON.stringify({ success: true, synced: false }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const { data: connections } = await adminClient.from("calendar_connections").select("*").in("id", targetConnectionIds).eq("org_id", membership.org_id);

    const results = await Promise.all((connections ?? []).map((conn: any) => syncOne(adminClient, event, conn, action)));
    const anySynced = results.some((r) => r.ok);
    const anyError = results.some((r) => !r.ok);

    if (action === "delete") {
      await adminClient.from("calendar_events").delete().eq("id", eventId);
    } else {
      // Keep a simple aggregate status on the event row itself for quick
      // display without joining calendar_event_syncs everywhere.
      await adminClient.from("calendar_events").update({
        sync_status: anyError && !anySynced ? "sync_error" : anySynced ? "synced" : "local",
      }).eq("id", eventId);
    }

    return new Response(JSON.stringify({ success: true, synced: anySynced, errors: results.filter((r) => !r.ok).map((r) => r.error) }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
