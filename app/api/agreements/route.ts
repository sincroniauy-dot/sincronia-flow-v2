// app/api/agreements/route.ts
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

// GET /api/agreements?caseId=&status=&pageSize=
export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    const { searchParams } = new URL(req.url);
    const caseId = searchParams.get("caseId") || undefined;
    const status = searchParams.get("status") || undefined; // active|cancelled|completed
    const limitParam = parseInt(searchParams.get("pageSize") || "20", 10);
    const pageSize = Math.max(1, Math.min(100, isNaN(limitParam) ? 20 : limitParam));

    let q = db.collection("agreements");

    // 🔧 Hotfix: cuando hay filtros, NO usamos orderBy para evitar índices compuestos.
    if (caseId) q = q.where("caseId", "==", caseId);
    if (status) q = q.where("status", "==", status);

    // Si NO hay filtros, sí ordenamos por createdAt desc (no requiere índice compuesto)
    const sortNeeded = !caseId && !status;
    if (sortNeeded) q = q.orderBy("createdAt", "desc");

    if (!isElevated(user.role)) {
      // gestor: restringir por casos asignados a él
      if (caseId) {
        const cs = await db.collection("cases").doc(caseId).get();
        if (!cs.exists) return json({ error: "CASE_NOT_FOUND" }, { status: 404 });
        if (cs.get("assignedTo") !== user.uid) return json({ error: "FORBIDDEN" }, { status: 403 });
      } else {
        // join pobre: traemos N y filtramos por cases asignados al gestor
        const snaps = await q.limit(pageSize).get();
        const list = [];
        for (const d of snaps.docs) {
          const cId = d.get("caseId");
          const cs = await db.collection("cases").doc(cId).get();
          if (cs.exists && cs.get("assignedTo") === user.uid) {
            list.push({ id: d.id, ...serialize(d.data()) });
          }
        }
        // ordenamos en memoria si no hubo sort en servidor
        if (!sortNeeded) {
          list.sort((a: any, b: any) => {
            const ta = new Date(a.createdAt ?? 0).getTime();
            const tb = new Date(b.createdAt ?? 0).getTime();
            return tb - ta;
          });
        }
        return json({ data: list }, { status: 200 });
      }
    }

    const snaps = await q.limit(pageSize).get();
    let data = snaps.docs.map((d) => ({ id: d.id, ...serialize(d.data()) }));
    // ordenamos en memoria si no hubo sort en servidor
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
    console.error("GET /api/agreements error:", e);
    return json({ error: "INTERNAL" }, { status: 500 });
  }
}

// POST /api/agreements
export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "INVALID_BODY" }, { status: 400 });

    const { caseId, amount, startDate, installments, terms } = body;

    if (!caseId || typeof amount !== "number" || amount <= 0 || !startDate || !installments || installments < 1) {
      return json({ error: "VALIDATION", fields: ["caseId", "amount>0", "startDate", "installments>=1"] }, { status: 400 });
    }

    // Autorización: gestor solo en casos propios
    const cs = await db.collection("cases").doc(caseId).get();
    if (!cs.exists) return json({ error: "CASE_NOT_FOUND" }, { status: 404 });
    if (!isElevated(user.role) && cs.get("assignedTo") !== user.uid) {
      return json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const now = FieldValue.serverTimestamp();

    const docRef = await db.collection("agreements").add({
      caseId,
      amount,
      startDate: new Date(String(startDate)),
      installments,
      status: "active",
      terms: terms && typeof terms === "object" ? terms : {},
      createdBy: user.uid,
      createdAt: now,
      updatedAt: now,
    });

    await writeAudit({
      entity: "agreement",
      entityId: docRef.id,
      action: "create",
      by: user.uid,
      diff: { caseId, amount, startDate, installments, terms },
    });

    return json({ id: docRef.id }, { status: 201 });
  } catch (e: any) {
    if (String(e?.message) === "NO_TOKEN") {
      return withCORS(new NextResponse("Missing Authorization", { status: 401 }));
    }
    console.error("POST /api/agreements error:", e);
    return json({ error: "INTERNAL" }, { status: 500 });
  }
}
