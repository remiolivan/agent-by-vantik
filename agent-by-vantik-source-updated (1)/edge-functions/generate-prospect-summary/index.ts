import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

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

    const { prospectId } = await req.json();
    if (!prospectId) {
      return new Response(JSON.stringify({ error: "prospectId is required" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: membership } = await adminClient.from("memberships").select("id, org_id").eq("user_id", user.id).eq("status", "active").maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "No active membership" }), { status: 403, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const { data: prospect, error: prospectErr } = await adminClient
      .from("contacts").select("*, pipeline_stages(name)").eq("id", prospectId).eq("org_id", membership.org_id).single();
    if (prospectErr || !prospect) {
      return new Response(JSON.stringify({ error: "Prospect not found" }), { status: 404, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const { data: org } = await adminClient.from("organizations").select("name").eq("id", membership.org_id).single();

    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const nightfall = rgb(0.086, 0.129, 0.243);
    const fog = rgb(0.42, 0.45, 0.5);
    const teal = rgb(0.247, 0.659, 0.627);

    let y = 800;
    page.drawText(org?.name ?? "Agent by Vantik", { x: 50, y, size: 12, font: bold, color: fog });
    y -= 35;
    page.drawText(String(prospect.name ?? "Prospect"), { x: 50, y, size: 22, font: bold, color: nightfall });
    y -= 22;
    if (prospect.pipeline_stages?.name) {
      page.drawText(String(prospect.pipeline_stages.name), { x: 50, y, size: 10, font: bold, color: teal });
      y -= 20;
    }

    const contactLine = [prospect.email, prospect.phone].filter(Boolean).join("  ·  ");
    if (contactLine) {
      page.drawText(contactLine, { x: 50, y, size: 11, font, color: fog });
      y -= 25;
    }

    page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: fog });
    y -= 30;

    page.drawText("Looking for", { x: 50, y, size: 12, font: bold, color: nightfall });
    y -= 22;

    function row(label: string, value: string) {
      page.drawText(label, { x: 50, y, size: 10, font: bold, color: fog });
      page.drawText(value, { x: 180, y, size: 11, font, color: nightfall });
      y -= 20;
    }

    row("Intent", prospect.intent ? (prospect.intent === "buy" ? "Buying" : "Renting") : "Not set");
    const budgetText = (prospect.budget_min || prospect.budget_max)
      ? `${org?.base_currency || "AED"} ${prospect.budget_min ? Number(prospect.budget_min).toLocaleString("en-US") : "—"} to ${prospect.budget_max ? Number(prospect.budget_max).toLocaleString("en-US") : "—"}`
      : "Not set";
    row("Budget", budgetText);
    row("Bedrooms", (prospect.bedrooms_wanted_list && prospect.bedrooms_wanted_list.length > 0) ? prospect.bedrooms_wanted_list.join(", ") : "Not set");
    row("Locations", prospect.locations_wanted || "Not set");

    if (prospect.notes) {
      y -= 15;
      page.drawText("Notes", { x: 50, y, size: 12, font: bold, color: nightfall });
      y -= 20;
      const words = String(prospect.notes).split(/\s+/);
      let line = "";
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(test, 11) > 495) {
          page.drawText(line, { x: 50, y, size: 11, font, color: nightfall });
          y -= 16;
          line = w;
        } else {
          line = test;
        }
      }
      if (line) { page.drawText(line, { x: 50, y, size: 11, font, color: nightfall }); y -= 16; }
    }

    const pdfBytes = await doc.save();
    const path = `${membership.org_id}/prospects/${prospectId}/summary-${Date.now()}.pdf`;
    const { error: uploadErr } = await adminClient.storage
      .from("property-documents")
      .upload(path, pdfBytes, { contentType: "application/pdf", upsert: false });
    if (uploadErr) {
      return new Response(JSON.stringify({ error: uploadErr.message }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const { data: signed, error: signErr } = await adminClient.storage
      .from("property-documents")
      .createSignedUrl(path, 60 * 60 * 24 * 7);
    if (signErr || !signed) {
      return new Response(JSON.stringify({ error: signErr?.message || "Could not sign URL" }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, url: signed.signedUrl }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
