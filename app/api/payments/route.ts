// app/api/payments/route.ts
import "@/lib/firebaseAdmin";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const db = getFirestore();
const auth = getAuth();

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function withCORS(res: NextResponse) {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}
function json(data: any, init?: ResponseInit) {
  return withCORS(NextResponse.json(data, init));
}

export async function OPTIONS() {
  return withCORS(new NextResponse(null, { status: 204 }));
}

// ---- Helpers ----
type AuthUser = { uid: string; email?: string; role?: "gestor" | "supervisor" | "admin" };

function isElevated(role?: string) {
  return role === "admin" || role === "supervisor";
}

async function getUser(req: NextRequest): Promise<AuthUser> {
  const authz = req.headers.get("authorization") || "";
  if (!authz.startsWith("Bearer ")) {
    throw new Error("NO_TOKEN");
  }
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

// ---- GET /api/payments ----
export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);

    const { searchParams } = new URL(req.url);
    const caseId = searchParams.get("caseId") || undefined;
    const limitParam = parseInt(searchParams.get("pageSize") || "20", 10);
    const pageSize = Math.max(1, Math.min(100, isNaN(limitParam) ? 20 : limitParam));

    const col = db.collection("payments");
    let query = col.orderBy("date", "desc");

    if (caseId) {
      // Filtro por caseId
      query = query.where("caseId", "==", caseId);
      if (!isElevated(user.role)) {
        // Si es gestor, solo si el case le pertenece
        const caseSnap = await db.collection("cases").doc(caseId).get();
        if (!caseSnap.exists) return json({ error: "CASE_NOT_FOUND" }, { status: 404 });
        if (caseSnap.get("assignedTo") !== user.uid) {
          return json({ error: "FORBIDDEN" }, { status: 403 });
        }
      }
    } else {
      // Sin caseId
      if (!isElevated(user.role)) {
        // gestor: solo pagos creados por él
        query = query.where("createdBy", "==", user.uid);
      }
    }

    const snaps = await query.limit(pageSize).get();
    const data = snaps.docs.map((d) => ({ id: d.id, ...serialize(d.data()) }));

    return json({ data }, { status: 200 });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg === "NO_TOKEN") {
      return withCORS(new NextResponse("Missing Authorization: Bearer <idToken>", { status: 401 }));
    }
    console.error("GET /api/payments error:", e);
    return json({ error: "INTERNAL", detail: "payments_list_failed" }, { status: 500 });
  }
}

// ---- POST /api/payments ----
// Mantén aquí tu lógica existente de creación + transacción (descuento de balance).
// Si todavía no estaba implementada en este archivo, puedes pegar tu versión anterior.
// Este es un ejemplo mínimo protegido (NO cambia saldos; reemplázalo por tu versión oficial si ya la tenés).

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "INVALID_BODY" }, { status: 400 });

    const { caseId, amount, method = "cash", date = new Date().toISOString() } = body || {};
    if (!caseId || typeof amount !== "number" || amount <= 0) {
      return json({ error: "VALIDATION", fields: ["caseId", "amount>0"] }, { status: 400 });
    }

    // Autorización simple (gestor solo si el case le pertenece)
    if (!isElevated(user.role)) {
      const caseSnap = await db.collection("cases").doc(caseId).get();
      if (!caseSnap.exists) return json({ error: "CASE_NOT_FOUND" }, { status: 404 });
      if (caseSnap.get("assignedTo") !== user.uid) return json({ error: "FORBIDDEN" }, { status: 403 });
    }

    // Aquí deberías usar tu transacción real que descuenta del balance del case.
    // Para no romper tu flujo actual, dejamos una inserción mínima (sin alterar balance).
    // Reemplázalo por tu implementación oficial si ya la tenías.

    const doc = await db.collection("payments").add({
      caseId,
      amount,
      method,
      date: new Date(date),
      createdBy: user.uid,
      createdAt: FieldValue.serverTimestamp(),
      reconciled: false,
    });

    return json({ id: doc.id }, { status: 201 });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg === "NO_TOKEN") {
      return withCORS(new NextResponse("Missing Authorization: Bearer <idToken>", { status: 401 }));
    }
    console.error("POST /api/payments error:", e);
    return json({ error: "INTERNAL", detail: "payment_create_failed" }, { status: 500 });
  }
}
