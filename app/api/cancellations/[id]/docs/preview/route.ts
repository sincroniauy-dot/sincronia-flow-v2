import { NextRequest } from "next/server";
import crypto from "crypto";
import { renderCancellationPdf } from "@/lib/pdf";
import { writeAuditLog } from "@/lib/audit";

/** CORS para preflight */
export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "authorization,content-type,if-none-match,if-match"
    }
  });
}

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const id = ctx.params.id;

  // Armamos PDF en memoria
  const pdfBytes = await renderCancellationPdf({ id, notes: "preview" });

  // Buffer para que TypeScript quede conforme con BodyInit
  const body = Buffer.from(pdfBytes);

  // ETag fuerte
  const etag = `"${crypto.createHash("sha256").update(body).digest("base64url")}"`;
  const headers = new Headers({
    "Content-Type": "application/pdf",
    "Cache-Control": "private, max-age=0, must-revalidate",
    "ETag": etag,
    "Access-Control-Allow-Origin": "*"
  });

  const inm = req.headers.get("if-none-match");
  if (inm && inm === etag) {
    return new Response(null, { status: 304, headers });
  }

  await writeAuditLog({
    action: "cancellation.preview",
    entity: "cancellation",
    entityId: id
  });

  return new Response(body as any, { status: 200, headers });
}
