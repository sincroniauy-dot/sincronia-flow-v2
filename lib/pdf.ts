// lib/pdf.ts
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs/promises";
import path from "path";

type Options = {
  id: string;
  notes?: string;
  templateVersion?: "v1" | string;
};

/**
 * Genera un PDF simple (A4) con fuente Unicode (Noto Sans) si está disponible.
 * Devuelve los bytes como Uint8Array.
 */
export async function renderCancellationPdf({
  id,
  notes = "",
  templateVersion = "v1",
}: Options): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();

  // Registrar fontkit para poder embeber una fuente TTF/OTF
  // (si falla, usamos Helvetica estándar)
  try {
    pdf.registerFontkit(fontkit as any);
  } catch {
    /* ignore */
  }

  // Intentar cargar la fuente Unicode Noto Sans (incluida en el repo)
  let customFontBytes: Uint8Array | null = null;
  try {
    const fontPath = path.join(process.cwd(), "lib", "fonts", "NotoSans-Regular.ttf");
    const buf = await fs.readFile(fontPath);
    // Buffer es un Uint8Array compatible
    customFontBytes = buf as unknown as Uint8Array;
  } catch {
    customFontBytes = null;
  }

  // Embeber fuente (custom si existe, sino Helvetica)
  const font = customFontBytes
    ? await pdf.embedFont(customFontBytes, { subset: true })
    : await pdf.embedFont(StandardFonts.Helvetica);

  // Página A4
  const page = pdf.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  // Contenido
  const title = "Cancelación de Servicio";
  const lines = [
    `ID: ${id}`,
    `Notas: ${notes || "-"}`,
    `Versión de plantilla: ${templateVersion}`,
    `Emitido: ${new Date().toLocaleString("es-UY", { hour12: false })}`,
  ];

  // Título
  page.drawText(title, {
    x: 50,
    y: height - 80,
    size: 20,
    font,
    color: rgb(0, 0, 0),
  });

  // Texto
  let y = height - 120;
  for (const line of lines) {
    page.drawText(line, { x: 50, y, size: 12, font, color: rgb(0, 0, 0) });
    y -= 18;
  }

  // Devolver bytes
  return await pdf.save(); // Uint8Array
}
