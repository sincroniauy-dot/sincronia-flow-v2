import { NextRequest } from "next/server";
import { buildCorsHeaders, handleOptions } from "@/lib/cors";
import { buildCancellationPdf } from "@/lib/pdf";
import { etagForBuffer, cleanIfNoneMatch } from "@/lib/etag";

export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") || undefined;
  return handleOptions(origin);
}

export async function GET(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const origin = req.headers.get("origin") || undefined;
  const headers = buildCorsHeaders(origin);

  try {
    const [{ requireAuth }, { db }, { writeAuditLog }] = await Promise.all([
      import("@/lib/auth"),
      import("@/lib/firebaseAdmin"),
      import("@/lib/audit"),
    ]);

    const user = await requireAuth(req);
    const cancellationId = context.params.id;

    const snap = await db.collection("cancellations").doc(cancellationId).get();
    if (!snap.exists) {
      return new Response(
        JSON.stringify({ error: "Cancellation not found", code: "not_found" }),
        { status: 404, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }
    const c = snap.data() || {};

    // Construimos una huella ESTABLE basada en los datos (no en bytes del PDF)
    const createdAt =
      (c.createdAt?.toDate?.() || c.createdAt || new Date(0)).toISOString?.() ||
      new Date(0).toISOString();
    const stableKey = [
      "v1", // templateVersion fijo en preview
      cancellationId,
      c.caseId || "",
      c.paymentId || "",
      c.requester?.name || c.requesterName || "",
      c.requester?.email || c.requesterEmail || "",
      c.reason || "",
      String(c.amount ?? ""),
      c.currency || "UYU",
      createdAt,
      "Vista previa (no emitido).",
    ].join("|");
    const stableEtag = etagForBuffer(Buffer.from(stableKey, "utf8"));

    // Condicional: si coincide ETag => 304 sin regenerar PDF
    const inm = cleanIfNoneMatch(req.headers.get("if-none-match"));
    if (inm && inm === stableEtag) {
      return new Response(null, { status: 304, headers });
    }

    // Generar PDF solo si hace falta
    const pdfBytes = await buildCancellationPdf({
      cancellationId,
      caseId: c.caseId,
      paymentId: c.paymentId,
      requesterName: c.requester?.name || c.requesterName,
      requesterEmail: c.requester?.email || c.requesterEmail,
      reason: c.reason,
      amount: c.amount,
      currency: c.currency || "UYU",
      createdAtISO: createdAt,
      notes: "Vista previa (no emitido).",
      templateVersion: "v1",
    });

    await writeAuditLog(
      "cancellation.doc.preview",
      "cancellation",
      cancellationId,
      user.uid,
      { templateVersion: "v1", etag: stableEtag }
    );

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        ...headers,
        ETag: `"${stableEtag}"`,
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="cancellation_${cancellationId}_preview.pdf"`,
      },
    });
  } catch (err: any) {
    const status = err?.status || 500;
    const body = { error: err?.message || "Internal error", details: err?.details || String(err) };
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
}
