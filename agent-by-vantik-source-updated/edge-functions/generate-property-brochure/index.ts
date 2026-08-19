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
    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const { propertyId } = await req.json();
    if (!propertyId) {
      return new Response(JSON.stringify({ error: "propertyId is required" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: membership } = await adminClient
      .from("memberships").select("id, org_id").eq("user_id", user.id).eq("status", "active").maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "No active membership" }), { status: 403, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const { data: property, error: propErr } = await adminClient
      .from("properties").select("*").eq("id", propertyId).eq("org_id", membership.org_id).single();
    if (propErr || !property) {
      return new Response(JSON.stringify({ error: "Property not found" }), { status: 404, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const { data: org } = await adminClient.from("organizations").select("name").eq("id", membership.org_id).single();

    // Photos live in the public property-photos bucket under {org_id}/{property_id}/
    const { data: photoFiles } = await adminClient.storage
      .from("property-photos")
      .list(`${membership.org_id}/${propertyId}`, { limit: 4, sortBy: { column: "created_at", order: "asc" } });

    const photoBytesList: Uint8Array[] = [];
    for (const file of (photoFiles ?? [])) {
      const { data: blob } = await adminClient.storage
        .from("property-photos")
        .download(`${membership.org_id}/${propertyId}/${file.name}`);
      if (blob) photoBytesList.push(new Uint8Array(await blob.arrayBuffer()));
    }

    // Build the PDF
    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]); // A4
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const nightfall = rgb(0.086, 0.129, 0.243);
    const fog = rgb(0.42, 0.45, 0.5);
    const teal = rgb(0.247, 0.659, 0.627);

    let y = 800;
    page.drawText(org?.name ?? "Agent by Vantik", { x: 50, y, size: 12, font: bold, color: fog });
    y -= 35;
    page.drawText(String(property.title ?? "Property"), { x: 50, y, size: 22, font: bold, color: nightfall });
    y -= 24;

    if (property.listing_type) {
      const label = property.listing_type === "sale" ? "FOR SALE" : "FOR RENT";
      page.drawText(label, { x: 50, y, size: 11, font: bold, color: teal });
      y -= 20;
    }

    if (property.address) {
      page.drawText(String(property.address), { x: 50, y, size: 11, font, color: fog });
      y -= 25;
    }

    // Photos (embed up to 4, side by side in a 2x2 grid)
    if (photoBytesList.length > 0) {
      const gridX = [50, 315];
      const imgW = 230, imgH = 150;
      let col = 0, rowY = y - imgH;
      for (const bytes of photoBytesList) {
        try {
          let img;
          try { img = await doc.embedJpg(bytes); } catch { img = await doc.embedPng(bytes); }
          page.drawImage(img, { x: gridX[col], y: rowY, width: imgW, height: imgH });
        } catch { /* skip unreadable image */ }
        col++;
        if (col > 1) { col = 0; rowY -= (imgH + 12); }
      }
      const rows = Math.ceil(photoBytesList.length / 2);
      y -= rows * (imgH + 12) + 15;
    }

    page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: fog });
    y -= 25;

    if (property.value) {
      const priceText = `${property.currency || "USD"} ${Number(property.value).toLocaleString("en-US")}`;
      page.drawText(priceText, { x: 50, y, size: 16, font: bold, color: nightfall });
      y -= 26;
    }

    const facts: string[] = [];
    if (property.bedrooms) facts.push(`${property.bedrooms} bed`);
    if (property.bathrooms) facts.push(`${property.bathrooms} bath`);
    if (property.property_type) facts.push(String(property.property_type));
    if (facts.length) {
      page.drawText(facts.join("  ·  "), { x: 50, y, size: 11, font, color: fog });
      y -= 26;
    }

    if (property.description) {
      const words = String(property.description).split(/\s+/);
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
      y -= 15;
    }

    if (property.listing_url) {
      page.drawText("Full listing:", { x: 50, y, size: 10, font: bold, color: fog });
      y -= 15;
      page.drawText(String(property.listing_url), { x: 50, y, size: 10, font, color: teal });
      y -= 15;
    }

    const pdfBytes = await doc.save();

    const path = `${membership.org_id}/${propertyId}/brochure-${Date.now()}.pdf`;
    const { error: uploadErr } = await adminClient.storage
      .from("property-documents")
      .upload(path, pdfBytes, { contentType: "application/pdf", upsert: false });
    if (uploadErr) {
      return new Response(JSON.stringify({ error: uploadErr.message }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // Signed URL so the link works for the prospect (not org-scoped), valid 7 days.
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
