// app/api/audit/route.ts
import "@/lib/firebaseAdmin";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const db = getFirestore();
const auth = getAuth();

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

// GET /api/audit?entity=payment&entityId=...&pageSize=...
export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);

    const { searchParams } = new URL(req.url);
    const entity = searchParams.get("entity") || undefined;
    const entityId = searchParams.get("entityId") || undefined;

    const limitParam = parseInt(searchParams.get("pageSize") || "30", 10);
    const pageSize = Math.max(1, Math.min(200, isNaN(limitParam) ? 30 : limitParam));

    let q = db.collection("auditLogs");
    if (entity) q = q.where("entity", "==", entity);
    if (entityId) q = q.where("entityId", "==", entityId);

    // 🔧 Para evitar índices: NO usamos orderBy en servidor; limit y orden en memoria.
    const snaps = await q.limit(pageSize).get();
    let rows = snaps.docs.map((d) => ({ id: d.id, ...serialize(d.data()) }));

    // Orden en memoria por "at" desc (si falta, lo tratamos como 0)
    rows.sort((a: any, b: any) => {
      const ta = new Date(a.at ?? 0).getTime();
      const tb = new Date(b.at ?? 0).getTime();
      return tb - ta;
    });

    // Visibilidad: gestor solo ve lo suyo (simplificada para payments con entityId)
    if (!isElevated(user.role) && entity === "payment" && entityId) {
      try {
        const pay = await db.collection("payments").doc(entityId).get();
        if (pay.exists) {
          const caseId = pay.get("caseId");
          const cs = await db.collection("cases").doc(caseId).get();
          if (cs.exists && cs.get("assignedTo") !== user.uid) {
            return json({ data: [] }, { status: 200 });
          }
        }
      } catch {}
    }

    return json({ data: rows }, { status: 200 });
  } catch (e: any) {
    if (String(e?.message) === "NO_TOKEN") {
      return withCORS(new NextResponse("Missing Authorization", { status: 401 }));
    }
    console.error("GET /api/audit error:", e);
    return json({ error: "INTERNAL" }, { status: 500 });
  }
}
