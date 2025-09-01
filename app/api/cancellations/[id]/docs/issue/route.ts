import { NextRequest } from "next/server";
import { buildCorsHeaders, handleOptions } from "@/lib/cors";
import { buildCancellationPdf } from "@/lib/pdf";
import { etagForBuffer } from "@/lib/etag";
import { uploadBufferToStorage, getV4ReadSignedUrl } from "@/lib/storage";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") || undefined;
  return handleOptions(origin);
}

export async function POST(req: NextRequest, context: { params: { id: string } }) {
  const origin = req.headers.get("origin") || undefined;
  const headers = buildCorsHeaders(origin);

  try {
    const [{ requireAuth }, { db, bucket }, { writeAuditLog }] = await Promise.all([
      import("@/lib/auth"),
      import("@/lib/firebaseAdmin"),
      import("@/lib/audit"),
    ]);

    const user = await requireAuth(req);
    const cancellationId = context.params.id;

    const body = await req.json().catch(() => ({}));
    const templateVersion: string = body?.templateVersion || "v1";
    const notes: string | undefined = body?.notes;

    const ref = db.collection("cancellations").doc(cancellationId);
    const snap = await ref.get();
    if (!snap.exists) {
      return new Response(JSON.stringify({ error: "Cancellation not found", code: "not_found" }), {
        status: 404,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    const c = snap.data() || {};

    // Si ya existe documento en últimas 24h con misma templateVersion → devolver 200 con signedUrl
    const docsRef = ref.collection("documents");
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existingQ = await docsRef
      .where("templateVersion", "==", templateVersion)
      .where("createdAt", ">", since)
      .limit(1)
      .get();

    if (!existingQ.empty) {
      const d = existingQ.docs[0];
      const meta = d.data() as any;
      const signed = await getV4ReadSignedUrl(meta.path, 15);
      const resp = {
        id: d.id,
        cancellationId,
        bucket: bucket.name,
        path: meta.path,
        contentType: meta.contentType || "application/pdf",
        size: meta.size,
        etag: meta.etag,
        templateVersion,
        signedUrl: signed,
        signedUrlExpiresInMinutes: 15,
        status: "exists",
      };
      return new Response(JSON.stringify(resp), {
        status: 200,
        headers: { ...headers, "Content-Type": "application/json", ETag: `"${meta.etag}"` },
      });
    }

    // Generar PDF
    const pdfBytes = await buildCancellationPdf({
      cancellationId,
      caseId: c.caseId,
      paymentId: c.paymentId,
      requesterName: c.requester?.name || c.requesterName,
      requesterEmail: c.requester?.email || c.requesterEmail,
      reason: c.reason,
      amount: c.amount,
      currency: c.currency || "UYU",
      createdAtISO:
        (c.createdAt?.toDate?.() || c.createdAt || new Date()).toISOString?.() || new Date().toISOString(),
      notes: notes || "Documento emitido.",
      templateVersion,
    });

    const etag = etagForBuffer(pdfBytes);
    const t = new Date();
    const yyyy = String(t.getUTCFullYear());
    const mm = String(t.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(t.getUTCDate()).padStart(2, "0");
    const hh = String(t.getUTCHours()).padStart(2, "0");
    const mi = String(t.getUTCMinutes()).padStart(2, "0");
    const ss = String(t.getUTCSeconds()).padStart(2, "0");
    const fileName = `cancellation_${cancellationId}_${yyyy}${mm}${dd}T${hh}${mi}${ss}Z.pdf`;
    const path = `cancellations/${cancellationId}/documents/${fileName}`;

    const file = await uploadBufferToStorage(path, pdfBytes, "application/pdf", {
      cancellationId,
      templateVersion,
      etag,
      createdBy: user.uid,
    });

    const [metadata] = await file.getMetadata();
    const size = Number(metadata.size || pdfBytes.byteLength);

    const newDoc = await ref.collection("documents").add({
      path,
      bucket: file.bucket.name,
      contentType: "application/pdf",
      size,
      etag,
      templateVersion,
      createdBy: user.uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    await writeAuditLog("cancellation.doc.issue", "cancellation", cancellationId, user.uid, {
      documentId: newDoc.id,
      path,
      etag,
      templateVersion,
      size,
    });

    const signedUrl = await getV4ReadSignedUrl(path, 15);

    const resp = {
      id: newDoc.id,
      cancellationId,
      bucket: file.bucket.name,
      path,
      contentType: "application/pdf",
      size,
      etag,
      templateVersion,
      signedUrl,
      signedUrlExpiresInMinutes: 15,
      status: "created",
    };

    return new Response(JSON.stringify(resp), {
      status: 201,
      headers: { ...headers, "Content-Type": "application/json", ETag: `"${etag}"` },
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