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

    const { propertyId, prospectId, title, items, notes, dueDate, taxRate, currency } = await req.json();

    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: membership } = await adminClient
      .from("memberships").select("id, org_id").eq("user_id", user.id).eq("status", "active").maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "No active membership" }), { status: 403, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const { data: org } = await adminClient.from("organizations").select("*").eq("id", membership.org_id).single();
    const invoiceCurrency = currency || org?.base_currency || "AED";

    // Sequential invoice number per org: INV-0001, INV-0002, ...
    const { count: existingCount } = await adminClient
      .from("documents").select("*", { count: "exact", head: true }).eq("org_id", membership.org_id).eq("type", "invoice");
    const invoiceNumber = `INV-${String((existingCount ?? 0) + 1).padStart(4, "0")}`;

    let billToName: string | null = null;
    let billToAddress: string | null = null;
    if (prospectId) {
      const { data: contact } = await adminClient.from("contacts").select("name, email").eq("id", prospectId).maybeSingle();
      billToName = contact?.name ?? null;
    }
    let propertyTitle: string | null = null;
    if (propertyId) {
      const { data: property } = await adminClient.from("properties").select("title, address").eq("id", propertyId).maybeSingle();
      propertyTitle = property?.title ?? null;
      billToAddress = property?.address ?? null;
    }

    const subtotal = (items ?? []).reduce((sum: number, it: any) => sum + (Number(it.amount) || 0), 0);
    const rate = Number(taxRate) || 0;
    const taxAmount = subtotal * (rate / 100);
    const total = subtotal + taxAmount;

    // Build the PDF
    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]); // A4
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const nightfall = rgb(0.086, 0.129, 0.243);
    const fog = rgb(0.42, 0.45, 0.5);

    let y = 790;
    // Business identity (from the invoice configurator)
    page.drawText(org?.invoice_business_name || org?.name || "Agent by Vantik", { x: 50, y, size: 16, font: bold, color: nightfall });
    y -= 18;
    if (org?.invoice_address) { page.drawText(org.invoice_address, { x: 50, y, size: 9, font, color: fog }); y -= 13; }
    const contactLine = [org?.invoice_email, org?.invoice_phone].filter(Boolean).join("  ·  ");
    if (contactLine) { page.drawText(contactLine, { x: 50, y, size: 9, font, color: fog }); y -= 13; }
    if (org?.invoice_trn) { page.drawText(`TRN: ${org.invoice_trn}`, { x: 50, y, size: 9, font, color: fog }); y -= 13; }

    // Invoice meta, right-aligned block
    let metaY = 790;
    page.drawText("INVOICE", { x: 420, y: metaY, size: 16, font: bold, color: nightfall });
    metaY -= 20;
    page.drawText(invoiceNumber, { x: 420, y: metaY, size: 10, font, color: fog });
    metaY -= 14;
    page.drawText(`Date: ${new Date().toLocaleDateString("en-GB")}`, { x: 420, y: metaY, size: 9, font, color: fog });
    metaY -= 13;
    if (dueDate) { page.drawText(`Due: ${new Date(dueDate).toLocaleDateString("en-GB")}`, { x: 420, y: metaY, size: 9, font, color: fog }); metaY -= 13; }

    y = Math.min(y, metaY) - 20;

    if (billToName || propertyTitle) {
      page.drawText("Bill to", { x: 50, y, size: 9, font: bold, color: fog });
      y -= 14;
      if (billToName) { page.drawText(billToName, { x: 50, y, size: 11, font, color: nightfall }); y -= 14; }
      if (propertyTitle) { page.drawText(propertyTitle, { x: 50, y, size: 10, font, color: fog }); y -= 14; }
      if (billToAddress) { page.drawText(billToAddress, { x: 50, y, size: 10, font, color: fog }); y -= 14; }
      y -= 10;
    }

    if (title) { page.drawText(title, { x: 50, y, size: 12, font: bold, color: nightfall }); y -= 25; }

    page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: fog });
    y -= 20;
    page.drawText("Description", { x: 50, y, size: 9, font: bold, color: fog });
    page.drawText("Amount", { x: 480, y, size: 9, font: bold, color: fog });
    y -= 18;

    for (const item of (items ?? [])) {
      const amount = Number(item.amount) || 0;
      page.drawText(String(item.description ?? ""), { x: 50, y, size: 11, font, color: nightfall });
      page.drawText(`${invoiceCurrency} ${amount.toLocaleString("en-US")}`, { x: 480, y, size: 11, font, color: nightfall });
      y -= 20;
    }

    y -= 8;
    page.drawLine({ start: { x: 300, y }, end: { x: 545, y }, thickness: 1, color: fog });
    y -= 18;
    page.drawText("Subtotal", { x: 380, y, size: 10, font, color: fog });
    page.drawText(`${invoiceCurrency} ${subtotal.toLocaleString("en-US")}`, { x: 480, y, size: 10, font, color: nightfall });
    y -= 16;
    if (rate > 0) {
      page.drawText(`Tax (${rate}%)`, { x: 380, y, size: 10, font, color: fog });
      page.drawText(`${invoiceCurrency} ${taxAmount.toLocaleString("en-US")}`, { x: 480, y, size: 10, font, color: nightfall });
      y -= 16;
    }
    page.drawText("Total", { x: 380, y, size: 12, font: bold, color: nightfall });
    page.drawText(`${invoiceCurrency} ${total.toLocaleString("en-US")}`, { x: 480, y, size: 12, font: bold, color: nightfall });
    y -= 40;

    if (notes) {
      page.drawText("Notes", { x: 50, y, size: 9, font: bold, color: fog });
      y -= 14;
      page.drawText(String(notes), { x: 50, y, size: 10, font, color: fog, maxWidth: 495 });
      y -= 30;
    }

    if (org?.invoice_iban) {
      page.drawText(`Payment (IBAN): ${org.invoice_iban}`, { x: 50, y, size: 9, font, color: fog });
      y -= 20;
    }

    // Stamp, if configured, bottom-right above the footer
    if (org?.invoice_stamp_url) {
      try {
        const stampRes = await fetch(org.invoice_stamp_url);
        const stampBytes = new Uint8Array(await stampRes.arrayBuffer());
        let stampImg;
        try { stampImg = await doc.embedPng(stampBytes); } catch { stampImg = await doc.embedJpg(stampBytes); }
        const dims = stampImg.scale(80 / stampImg.width);
        page.drawImage(stampImg, { x: 465, y: 60, width: dims.width, height: dims.height });
      } catch { /* skip if the stamp can't be embedded */ }
    }

    // Discreet footer
    page.drawText("Made with Agent by Vantik", { x: 50, y: 30, size: 8, font, color: rgb(0.75, 0.76, 0.78) });

    const pdfBytes = await doc.save();
    const path = `${membership.org_id}/invoices/${invoiceNumber}-${Date.now()}.pdf`;
    const { error: uploadErr } = await adminClient.storage.from("property-documents").upload(path, pdfBytes, { contentType: "application/pdf" });
    if (uploadErr) {
      return new Response(JSON.stringify({ error: uploadErr.message }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const { data: docRow, error: insertErr } = await adminClient.from("documents").insert({
      org_id: membership.org_id,
      property_id: propertyId || null,
      contact_id: prospectId || null,
      type: "invoice",
      file_url: path,
      invoice_number: invoiceNumber,
      currency: invoiceCurrency,
      subtotal,
      tax_rate: rate || null,
      tax_amount: rate > 0 ? taxAmount : null,
      total,
      due_date: dueDate || null,
      notes: notes || null,
      items: items || null,
      generated_at: new Date().toISOString(),
      created_by: membership.id,
    }).select().single();

    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, document: docRow }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
