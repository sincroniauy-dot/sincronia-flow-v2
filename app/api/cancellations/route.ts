// app/api/cancellations/route.ts
import "@/lib/firebaseAdmin";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { NextRequest, NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

const db = getFirestore();
const auth = getAuth();

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function withCORS(res: NextResponse) {
  for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
  return res;
}
function json(data: any, init?: ResponseInit) {
  return withCORS(NextResponse.json(data, init));
}
export async function OPTIONS() {
  return withCORS(new NextResponse(null, { status: 204 }));
}

type Role = "gestor" | "supervisor" | "admin";
type AuthUser = { uid: string; email?: string; role: Role };

function isElevated(role?: string) {
  return role === "admin" || role === "supervisor";
}

async function getUser(req: NextRequest): Promise<AuthUser> {
  const authz = req.headers.get("authorization") || "";
  if (!authz.startsWith("Bearer ")) throw new Error("NO_TOKEN");
  const token = authz.slice(7).trim();
  const decoded = await auth.verifyIdToken(token, false);

  let role: any =
    (decoded as any).role ||
    (((decoded as any).roles && (decoded as any).roles[0]) || undefined);

  if (!role) {
    try {
      const udoc = await db.collection("users").doc(decoded.uid).get();
      role = (udoc.exists && (udoc.get("role") as string)) || "gestor";
    } catch {
      role = "gestor";
    }
  }
  return { uid: decoded.uid, email: decoded.email, role };
}

function serialize(v: any): any {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (Array.isArray(v)) return v.map(serialize);
  if (v && typeof v === "object") {
    const out: any = {};
    for (const [k, val] of Object.entries(v)) out[k] = serialize(val);
    return out;
  }
  return v;
}

// GET /api/cancellations?caseId=&paymentId=&pageSize=
export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    const { searchParams } = new URL(req.url);
    const caseId = searchParams.get("caseId") || undefined;
    const paymentId = searchParams.get("paymentId") || undefined;

    const limitParam = parseInt(searchParams.get("pageSize") || "20", 10);
    const pageSize = Math.max(1, Math.min(100, isNaN(limitParam) ? 20 : limitParam));

    let q = db.collection("cancellations");
    if (caseId) q = q.where("caseId", "==", caseId);
    if (paymentId) q = q.where("paymentId", "==", paymentId);

    // Si no hay filtros, ordenamos por createdAt desc (no requiere índice compuesto)
    const sortNeeded = !caseId && !paymentId;
    if (sortNeeded) q = q.orderBy("createdAt", "desc");

    // Reglas por rol: gestor sólo ve cancelaciones de sus casos
    if (!isElevated(user.role)) {
      const snaps = await q.limit(pageSize).get();
      const list: any[] = [];
      for (const d of snaps.docs) {
        const cId = d.get("caseId");
        const cs = await db.collection("cases").doc(cId).get();
        if (cs.exists && cs.get("assignedTo") === user.uid) {
          list.push({ id: d.id, ...serialize(d.data()) });
        }
      }
      if (!sortNeeded) {
        list.sort((a: any, b: any) => {
          const ta = new Date(a.createdAt ?? 0).getTime();
          const tb = new Date(b.createdAt ?? 0).getTime();
          return tb - ta;
        });
      }
      return json({ data: list }, { status: 200 });
    }

    const snaps = await q.limit(pageSize).get();
    let data = snaps.docs.map((d) => ({ id: d.id, ...serialize(d.data()) }));
    if (!sortNeeded) {
      data.sort((a: any, b: any) => {
        const ta = new Date(a.createdAt ?? 0).getTime();
        const tb = new Date(b.createdAt ?? 0).getTime();
        return tb - ta;
      });
    }
    return json({ data }, { status: 200 });
  } catch (e: any) {
    if (String(e?.message) === "NO_TOKEN") {
      return withCORS(new NextResponse("Missing Authorization", { status: 401 }));
    }
    console.error("GET /api/cancellations error:", e);
    return json({ error: "INTERNAL" }, { status: 500 });
  }
}

// POST /api/cancellations  (cancela un pago y revierte el balance)
export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const { paymentId, reason = "" } = body;
    if (!paymentId || typeof paymentId !== "string") {
      return json({ error: "VALIDATION", field: "paymentId" }, { status: 400 });
    }

    // Sólo supervisor/admin pueden cancelar pagos (ajustable)
    if (!isElevated(user.role)) {
      return json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const result = await db.runTransaction(async (tx) => {
      const payRef = db.collection("payments").doc(paymentId);
      const paySnap = await tx.get(payRef);
      if (!paySnap.exists) throw new Error("PAYMENT_NOT_FOUND");

      const payment = paySnap.data()!;
      const caseId = String(payment.caseId);
      const amount = Number(payment.amount || 0);
      const status = payment.status || "posted";

      if (status === "cancelled") {
        throw new Error("ALREADY_CANCELLED");
      }

      const caseRef = db.collection("cases").doc(caseId);
      const caseSnap = await tx.get(caseRef);
      if (!caseSnap.exists) throw new Error("CASE_NOT_FOUND");

      // Revertir balance del caso: +amount
      const prevBalance = Number(caseSnap.get("balance") || 0);
      const newBalance = prevBalance + amount;

      const now = FieldValue.serverTimestamp();
      const cancelRef = db.collection("cancellations").doc();

      tx.set(cancelRef, {
        paymentId,
        caseId,
        amount,
        reason: String(reason || ""),
        createdBy: user.uid,
        createdAt: now,
      });

      tx.update(payRef, {
        status: "cancelled",
        cancelledAt: now,
        updatedAt: now,
      });

      tx.update(caseRef, {
        balance: newBalance,
        updatedAt: now,
      });

      return { id: cancelRef.id, caseId, amount, newBalance };
    });

    await writeAudit({
      entity: "payment",
      entityId: paymentId,
      action: "status_change",
      by: user.uid,
      diff: { status: "cancelled", reason },
      meta: { kind: "payment_cancellation", cancellationId: result.id },
    });

    await writeAudit({
      entity: "case",
      entityId: result.caseId,
      action: "update",
      by: user.uid,
      diff: { balance: result.newBalance },
      meta: { reason: "payment_cancelled", paymentId },
    });

    return json({ id: result.id, newBalance: result.newBalance }, { status: 201 });
  } catch (e: any) {
    if (String(e?.message) === "NO_TOKEN") {
      return withCORS(new NextResponse("Missing Authorization", { status: 401 }));
    }
    const msg = String(e?.message || e);
    if (msg === "PAYMENT_NOT_FOUND") return json({ error: "PAYMENT_NOT_FOUND" }, { status: 404 });
    if (msg === "CASE_NOT_FOUND") return json({ error: "CASE_NOT_FOUND" }, { status: 404 });
    if (msg === "ALREADY_CANCELLED") return json({ error: "ALREADY_CANCELLED" }, { status: 409 });
    console.error("POST /api/cancellations error:", e);
    return json({ error: "INTERNAL" }, { status: 500 });
  }
}
