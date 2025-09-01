import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type Args = {
  cancellationId: string;
  caseId?: string;
  paymentId?: string;
  requesterName?: string;
  requesterEmail?: string;
  reason?: string;
  amount?: number;
  currency?: string;
  createdAtISO?: string;
  notes?: string;
  templateVersion: string;
};

export async function buildCancellationPdf(a: Args): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = 800;
  function draw(label: string, value?: string) {
    if (y < 80) { pdf.addPage([595.28, 841.89]); y = 800; }
    page.drawText(label, { x: 50, y, size: 12, font: bold, color: rgb(0,0,0) }); y -= 16;
    if (value) { page.drawText(value, { x: 50, y, size: 12, font, color: rgb(0,0,0) }); y -= 22; }
  }

  page.drawText("Documento de Cancelación", { x: 50, y, size: 18, font: bold }); y -= 30;
  draw("Template:", a.templateVersion);
  draw("Cancellation ID:", a.cancellationId);
  draw("Case ID:", a.caseId || "-");
  draw("Payment ID:", a.paymentId || "-");
  draw("Requester:", [a.requesterName, a.requesterEmail].filter(Boolean).join(" · ") || "-");
  draw("Reason:", a.reason || "-");
  draw("Amount:", a.amount != null ? `${a.amount} ${a.currency || ""}`.trim() : "-");
  draw("Created at:", a.createdAtISO || new Date().toISOString());
  draw("Notes:", a.notes || "-");

  return pdf.save();
}