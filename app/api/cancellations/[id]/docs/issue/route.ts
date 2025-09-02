import { NextRequest } from "next/server";
import { bucket } from "@/lib/firebaseAdmin";
import { renderCancellationPdf } from "@/lib/pdf";
import { writeAuditLog } from "@/lib/audit";

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

  const pdfBytes = await renderCancellationPdf({ id, notes, templateVersion });
  const body = Buffer.from(pdfBytes);

  const ts = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const path = `cancellations/${id}/documents/cancellation_${id}_${ts}.pdf`;

  const file = bucket.file(path);
  await file.save(body, {
    contentType: "application/pdf",
    resumable: false,
    public: false
  });

  const [meta] = await file.getMetadata();
  const [signedUrl] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + 15 * 60 * 1000
  });

  await writeAuditLog({
    action: "cancellation.issue",
    entity: "cancellation",
    entityId: id,
    metadata: { templateVersion }
  });

  return Response.json(
    {
      id: file.id ?? undefined,
      cancellationId: id,
      bucket: bucket.name,
      path,
      contentType: "application/pdf",
      size: meta?.size ? Number(meta.size) : undefined,
      templateVersion,
      signedUrl,
      signedUrlExpiresInMinutes: 15,
      status: "created"
    },
    { status: 201, headers: { "Access-Control-Allow-Origin": "*" } }
  );
}
