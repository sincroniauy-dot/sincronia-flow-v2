import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import path from "path";
import { readFile } from "fs/promises";

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

let cachedFontBytes: Uint8Array | null = null;

async function loadFontBytes(): Promise<Uint8Array> {
  if (cachedFontBytes) return cachedFontBytes;
  const fontPath =
    process.env.PDF_FONT_PATH ||
    path.join(process.cwd(), "lib", "fonts", "NotoSans-Regular.ttf");
  const bytes = await readFile(fontPath);
  cachedFontBytes = new Uint8Array(bytes);
  return cachedFontBytes;
}

export async function buildCancellationPdf(a: Args): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fontBytes = await loadFontBytes();
  const font = await pdf.embedFont(fontBytes, { subset: true });

  const page = pdf.addPage([595.28, 841.89]); // A4
  let y = 800;

  function draw(label: string, value?: string) {
    if (y < 80) {
      pdf.addPage([595.28, 841.89]);
      y = 800;
    }
    page.drawText(label, { x: 50, y, size: 12, font, color: rgb(0, 0, 0) });
    y -= 16;
    if (value) {
      page.drawText(value, { x: 50, y, size: 12, font, color: rgb(0, 0, 0) });
      y -= 22;
    }
  }

  // Título (misma fuente, tamaño mayor)
  page.drawText("Documento de Cancelación", {
    x: 50,
    y,
    size: 18,
    font,
    color: rgb(0, 0, 0),
  });
  y -= 30;

  draw("Template:", a.templateVersion);
  draw("Cancellation ID:", a.cancellationId);
  draw("Case ID:", a.caseId || "-");
  draw("Payment ID:", a.paymentId || "-");
  draw(
    "Requester:",
    [a.requesterName, a.requesterEmail].filter(Boolean).join(" · ") || "-"
  );
  draw("Reason:", a.reason || "-");
  draw(
    "Amount:",
    a.amount != null ? `${a.amount} ${a.currency || ""}`.trim() : "-"
  );
  draw("Created at:", a.createdAtISO || new Date().toISOString());
  draw("Notes:", a.notes || "-");

  return pdf.save();
}
