import { NextRequest } from "next/server";
import { renderCancellationPdf } from "@/lib/pdf";
import { writeAuditLog } from "@/lib/audit";
import { bucket as adminBucket } from "@/lib/firebaseAdmin";
import fs from "fs/promises";
import path from "path";

/** CORS para preflight */
export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "authorization,content-type,if-none-match,if-match"
    }
  });
}

type Body = { templateVersion?: string; notes?: string };

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const id = ctx.params.id;
  const { templateVersion = "v1", notes = "" } = (await req.json().catch(() => ({}))) as Body;

  // Render del PDF
  const pdfBytes = await renderCancellationPdf({ id, notes, templateVersion });
  const body = Buffer.from(pdfBytes);

  // Nombre con timestamp compacto
  const ts = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const relPath = `cancellations/${id}/documents/cancellation_${id}_${ts}.pdf`;

  // Respuesta base
  const result: {
    id?: string;
    cancellationId: string;
    bucket?: string;
    path: string;
    contentType: "application/pdf";
    size: number;
    templateVersion: string;
    signedUrl?: string;
    signedUrlExpiresInMinutes?: number;
    status: "created" | "created-local";
  } = {
    cancellationId: id,
    path: relPath,
    contentType: "application/pdf",
    size: body.length,
    templateVersion,
    status: "created"
  };

  try {
    // Intentar guardar en GCS si hay bucket disponible
    const bucket: any = adminBucket as any;
    if (bucket && typeof bucket.file === "function") {
      const file = bucket.file(relPath);
      await file.save(body, {
        contentType: "application/pdf",
        resumable: false,
        public: false
      });

      const [meta] = await file.getMetadata().catch(() => [{} as any]);
      const [signedUrl] = await file
        .getSignedUrl({ action: "read", expires: Date.now() + 15 * 60 * 1000 })
        .catch(() => [undefined]);

      result.id = file.id ?? undefined;
      result.bucket = bucket.name;
      result.size = meta?.size ? Number(meta.size) : body.length;
      if (signedUrl) {
        result.signedUrl = signedUrl;
        result.signedUrlExpiresInMinutes = 15;
      }
    } else {
      // Sin bucket/admin -> fallback local a /tmp del proyecto
      throw new Error("NoBucket");
    }
  } catch {
    const absDir = path.join(process.cwd(), "tmp", "cancellations", id, "documents");
    await fs.mkdir(absDir, { recursive: true });
    const absFile = path.join(absDir, path.basename(relPath));
    await fs.writeFile(absFile, body);

    result.status = "created-local";
    result.bucket = "local-fs";
  }

  // Auditoría (no-op en local si así lo dejaste)
  await writeAuditLog({
    action: "cancellation.issue",
    entity: "cancellation",
    entityId: id,
    metadata: { templateVersion, issuedAt: new Date().toISOString() }
  }).catch(() => {});

  return Response.json(result, {
    status: 201,
    headers: { "Access-Control-Allow-Origin": "*" }
  });
}
