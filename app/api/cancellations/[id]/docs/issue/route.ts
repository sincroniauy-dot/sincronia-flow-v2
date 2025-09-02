// app/api/cancellations/[id]/docs/issue/route.ts
import { auth, bucket, db } from "@/lib/firebaseAdmin";
import { writeAuditLog } from "@/lib/audit";
import { PDFDocument, StandardFonts } from "pdf-lib";

type IssueBody = {
  templateVersion?: string;
  notes?: string;
};

function buildCorsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("origin") ?? "*";
  return {
    "vary": "Origin",
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "authorization,content-type,if-match,if-none-match",
    "access-control-expose-headers": "etag,content-type,content-disposition",
    "access-control-max-age": "86400"
  };
}

async function requireUid(request: Request): Promise<string> {
  const authz = request.headers.get("authorization") || "";
  const m = authz.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    throw new Response(JSON.stringify({ error: "Missing Bearer token" }), {
      status: 401,
      headers: { "content-type": "application/json" }
    });
  }
  try {
    const decoded = await auth.verifyIdToken(m[1]);
    return decoded.uid;
  } catch {
    throw new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { "content-type": "application/json" }
    });
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: buildCorsHeaders(request) });
}

export async function POST(request: Request, ctx: { params: { id: string } }) {
  const headers = buildCorsHeaders(request);

  try {
    const uid = await requireUid(request);
    const id = ctx.params?.id;
    if (!id) {
      return new Response(JSON.stringify({ error: "Missing cancellation id" }), {
        status: 400,
        headers: { ...headers, "content-type": "application/json" }
      });
    }

    const body = (await request.json().catch(() => ({}))) as IssueBody;
    const templateVersion = body.templateVersion || "v1";
    const notes = body.notes || "";

    // ====== Generar PDF simple (independiente de helpers) ======
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]); // A4
    const font = await pdf.embedFont(StandardFonts.Helvetica);

    const title = `Cancellation ${id}`;
    const text = [
      `ID: ${id}`,
      `Issued by: ${uid}`,
      `Template: ${templateVersion}`,
      `Notes: ${notes}`,
      `Issued at: ${new Date().toISOString()}`
    ].join("\n");

    page.setFont(font);
    page.setFontSize(18);
    page.drawText(title, { x: 50, y: 780 });

    page.setFontSize(12);
    page.drawText(text, { x: 50, y: 740, lineHeight: 16 });

    const pdfBytes = await pdf.save();

    // ====== Subir a Storage ======
    const ts = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z"); // 20250901T213049Z
    const fileName = `cancellation_${id}_${ts}.pdf`;
    const path = `cancellations/${id}/documents/${fileName}`;

    const file = bucket.file(path);
    await file.save(Buffer.from(pdfBytes), {
      resumable: false,
      contentType: "application/pdf",
      metadata: { cacheControl: "private, max-age=0, no-transform" }
    });

    const [meta] = await file.getMetadata();
    const etag = meta.etag || "";
    const size = Number(meta.size || pdfBytes.length);

    // URL firmada por 15 minutos
    const expires = new Date(Date.now() + 15 * 60 * 1000);
    const [signedUrl] = await file.getSignedUrl({ action: "read", expires });

    // ====== Audit Log + (opcional) persistencia mínima ======
    await writeAuditLog({
      entity: "cancellation-doc",
      entityId: id,
      action: "issue",
      by: uid,
      meta: { path, etag, size, templateVersion }
    });

    const docRef = await db.collection("cancellationDocuments").add({
      cancellationId: id,
      path,
      contentType: "application/pdf",
      size,
      etag,
      templateVersion,
      createdAt: new Date(),
      createdBy: uid
    });

    // Respuesta
    const payload = {
      id: docRef.id,
      cancellationId: id,
      bucket: (bucket as any).name,
      path,
      contentType: "application/pdf",
      size,
      etag,
      templateVersion,
      signedUrl,
      signedUrlExpiresInMinutes: 15,
      status: "created"
    };

    return new Response(JSON.stringify(payload), {
      status: 201,
      headers: { ...headers, "content-type": "application/json" }
    });
  } catch (err: any) {
    // Si el error ya es un Response (por auth), devuélvelo tal cual pero con CORS
    if (err instanceof Response) {
      const h = new Headers(err.headers);
      for (const [k, v] of Object.entries(buildCorsHeaders(request))) h.set(k, v as string);
      return new Response(err.body, { status: err.status, headers: h });
    }
    const message = (err && err.message) || String(err);
    return new Response(JSON.stringify({ error: "Issue failed", details: message }), {
      status: 500,
      headers: { ...buildCorsHeaders(request), "content-type": "application/json" }
    });
  }
}
