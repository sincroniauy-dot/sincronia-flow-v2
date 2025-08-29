// /api/payments - COMPLETO (auth + Firestore + reglas de rol)
import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "../../../lib/firebaseAdmin";
import { verifyAuth, requireRole } from "../../../lib/Auth/requireAuth";

type Role = "gestor" | "supervisor" | "admin";

function parseDate(value: any): Date {
  const d = value ? new Date(value) : new Date();
  if (isNaN(d.getTime())) return new Date();
  return d;
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await verifyAuth(req);
    const gate = requireRole(ctx, ["gestor", "supervisor", "admin"]);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const db = getFirestore();
    const { searchParams } = new URL(req.url);
    const pageSize = Math.min(Math.max(parseInt(searchParams.get("pageSize") || "50", 10), 1), 200);
    const caseId = searchParams.get("caseId");

    let query: FirebaseFirestore.Query = db.collection("payments");

    if (caseId) {
      query = query.where("caseId", "==", caseId);
      // gestor solo ve pagos de sus casos
      if (ctx!.role === "gestor") {
        const caseDoc = await db.collection("cases").doc(caseId).get();
        if (!caseDoc.exists) return NextResponse.json({ error: "CASE_NOT_FOUND" }, { status: 404 });
        const assignedTo = (caseDoc.data() as any).assignedTo;
        if (assignedTo !== ctx!.uid) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      }
    } else if (ctx!.role === "gestor") {
      // sin caseId: gestor solo ve pagos creados por él
      query = query.where("createdBy", "==", ctx!.uid);
    }

    query = query.orderBy("date", "desc").limit(pageSize);
    const snap = await query.get();
    const data = snap.docs.map(d => d.data());
    return NextResponse.json({ data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await verifyAuth(req);
    const gate = requireRole(ctx, ["gestor", "supervisor", "admin"]);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const db = getFirestore();
    const body = await req.json();

    const caseId: string | undefined = body.caseId;
    const amount: number | undefined = typeof body.amount === "number" ? body.amount : undefined;
    const method: string = body.method || "other";
    const date = parseDate(body.date);

    if (!caseId || !amount || amount <= 0) {
      return NextResponse.json({ error: "caseId and amount > 0 are required" }, { status: 400 });
    }

    const result = await db.runTransaction(async (tx) => {
      const caseRef = db.collection("cases").doc(caseId);
      const caseSnap = await tx.get(caseRef);
      if (!caseSnap.exists) throw new Error("CASE_NOT_FOUND");
      const caseData = caseSnap.data() as any;

      // gestor solo opera sobre casos asignados a él/ella
      if (ctx!.role === "gestor" && caseData.assignedTo !== ctx!.uid) {
        throw new Error("FORBIDDEN");
      }

      const paymentRef = db.collection("payments").doc();
      const now = new Date();

      const paymentDoc = {
        id: paymentRef.id,
        caseId,
        amount,
        method,
        date,
        createdBy: ctx!.uid,
        createdAt: now,
      };

      const prevBalance = Number(caseData.balance || 0);
      const newBalance = Math.max(prevBalance - amount!, 0);

      tx.set(paymentRef, paymentDoc);
      tx.update(caseRef, { balance: newBalance, updatedAt: now });

      return { id: paymentRef.id, newBalance };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    if (err?.message === "CASE_NOT_FOUND") return NextResponse.json({ error: "CASE_NOT_FOUND" }, { status: 404 });
    if (err?.message === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
