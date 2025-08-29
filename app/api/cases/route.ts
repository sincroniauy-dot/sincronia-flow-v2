// app/api/cases/route.ts
import "@/lib/firebaseAdmin";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { NextRequest, NextResponse } from "next/server";

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

// GET /api/cases?pageSize=
export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    const { searchParams } = new URL(req.url);
    const limitParam = parseInt(searchParams.get("pageSize") || "20", 10);
    const pageSize = Math.max(1, Math.min(100, isNaN(limitParam) ? 20 : limitParam));

    let q = db.collection("cases");
    // Si es gestor, filtra por assignedTo (sin orderBy para evitar índice compuesto)
    if (!isElevated(user.role)) {
      q = q.where("assignedTo", "==", user.uid);
    } else {
      // si es admin/supervisor, puede ordenar por createdAt desc
      q = q.orderBy("createdAt", "desc");
    }

    const snaps = await q.limit(pageSize).get();
    let data = snaps.docs.map((d) => ({ id: d.id, ...serialize(d.data()) }));

    // Si no hubo orderBy en servidor (gestor), ordenamos en memoria por createdAt desc
    if (!isElevated(user.role)) {
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
    console.error("GET /api/cases error:", e);
    return json({ error: "INTERNAL" }, { status: 500 });
  }
}

// POST /api/cases  (solo supervisor/admin)
export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!isElevated(user.role)) {
      return json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const { debtorName = null, assignedTo = "", balance = 0 } = body;
    if (typeof balance !== "number" || balance < 0) {
      return json({ error: "VALIDATION", field: "balance>=0" }, { status: 400 });
    }

    const now = FieldValue.serverTimestamp();
    const ref = await db.collection("cases").add({
      debtorName: debtorName || null,
      assignedTo: String(assignedTo || ""),
      balance: Number(balance || 0),
      status: "open",
      createdAt: now,
      updatedAt: now,
    });

    return json({ id: ref.id }, { status: 201 });
  } catch (e: any) {
    if (String(e?.message) === "NO_TOKEN") {
      return withCORS(new NextResponse("Missing Authorization", { status: 401 }));
    }
    console.error("POST /api/cases error:", e);
    return json({ error: "INTERNAL" }, { status: 500 });
  }
}
