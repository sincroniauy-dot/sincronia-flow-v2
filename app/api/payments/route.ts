// app/api/payments/route.ts
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

// GET /api/payments?caseId=&pageSize=
export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    const { searchParams } = new URL(req.url);
    const caseId = searchParams.get("caseId") || undefined;
    const limitParam = parseInt(searchParams.get("pageSize") || "20", 10);
    const pageSize = Math.max(1, Math.min(100, isNaN(limitParam) ? 20 : limitParam));

    let q = db.collection("payments");
    if (caseId) q = q.where("caseId", "==", caseId);

    const sortNeeded = !caseId; // solo ordenamos en server si no hay filtros
    if (sortNeeded) q = q.orderBy("date", "desc");

    if (!isElevated(user.role)) {
      if (caseId) {
        // validar propiedad del case
        const cs = await db.collection("cases").doc(caseId).get();
        if (!cs.exists) return json({ error: "CASE_NOT_FOUND" }, { status: 404 });
        if (cs.get("assignedTo") !== user.uid) return json({ error: "FORBIDDEN" }, { status: 403 });
      } else {
        // gestor sin caseId: sólo sus pagos (createdBy)
        q = q.where("createdBy", "==", user.uid);
      }
    }

    const snaps = await q.limit(pageSize).get();
    let data = snaps.docs.map((d) => ({ id: d.id, ...serialize(d.data()) }));
    if (!sortNeeded) {
      data.sort((a: any, b: any) => {
        const ta = new Date(a.date ?? 0).getTime();
        const tb = new Date(b.date ?? 0).getTime();
        return tb - ta;
      });
    }
    return json({ data }, { status: 200 });
  } catch (e: any) {
    if (String(e?.message) === "NO_TOKEN") {
      return withCORS(new NextResponse("Missing Authorization", { status: 401 }));
    }
    console.error("GET /api/payments error:", e);
    return json({ error: "INTERNAL" }, { status: 500 });
  }
}

// POST /api/payments  (crea pago y descuenta balance en transacción) + audit
export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const { caseId, amount, method = "other", date = new Date().toISOString() } = body;
    if (!caseId || typeof amount !== "number" || amount <= 0) {
      return json({ error: "VALIDATION", fields: ["caseId", "amount>0"] }, { status: 400 });
    }

    // Autorización
    const cs = await db.collection("cases").doc(caseId).get();
    if (!cs.exists) return json({ error: "CASE_NOT_FOUND" }, { status: 404 });
    if (!isElevated(user.role) && cs.get("assignedTo") !== user.uid) {
      return json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const result = await db.runTransaction(async (tx) => {
      const caseRef = db.collection("cases").doc(caseId);
      const caseSnap = await tx.get(caseRef);
      if (!caseSnap.exists) throw new Error("CASE_NOT_FOUND");

      const prev = Number(caseSnap.get("balance") || 0);
      const newBalance = Math.max(prev - amount, 0);
      const now = FieldValue.serverTimestamp();

      const payRef = db.collection("payments").doc();
      tx.set(payRef, {
        caseId,
        amount,
        method: String(method || "other"),
        date: new Date(String(date)),
        createdBy: user.uid,
        createdAt: now,
        updatedAt: now,
        status: "posted",
      });

      tx.update(caseRef, {
        balance: newBalance,
        updatedAt: now,
      });

      return { id: payRef.id, newBalance };
    });

    // AUDIT: crear pago + ajuste de caso
    await writeAudit({
      entity: "payment",
      entityId: result.id,
      action: "create",
      by: user.uid,
      diff: { caseId, amount, method, date },
    });
    await writeAudit({
      entity: "case",
      entityId: caseId,
      action: "update",
      by: user.uid,
      diff: { balance: result.newBalance },
      meta: { reason: "payment_posted", paymentId: result.id },
    });

    return json({ id: result.id, newBalance: result.newBalance }, { status: 201 });
  } catch (e: any) {
    if (String(e?.message) === "NO_TOKEN") {
      return withCORS(new NextResponse("Missing Authorization", { status: 401 }));
    }
    const msg = String(e?.message || e);
    if (msg === "CASE_NOT_FOUND") return json({ error: "CASE_NOT_FOUND" }, { status: 404 });
    console.error("POST /api/payments error:", e);
    return json({ error: "INTERNAL" }, { status: 500 });
  }
}
