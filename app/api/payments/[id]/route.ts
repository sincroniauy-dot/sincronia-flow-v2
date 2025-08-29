// app/api/payments/[id]/route.ts
import "@/lib/firebaseAdmin";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const db = getFirestore();
const auth = getAuth();

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, If-Match",
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

// ---- helpers ----
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

function etagFromUpdateTime(updateTime?: FirebaseFirestore.Timestamp) {
  return updateTime ? `"${updateTime.toMillis()}"` : undefined;
}

// ---- GET /api/payments/[id] ----
export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const id = ctx.params?.id;
    if (!id) return json({ error: "MISSING_ID" }, { status: 400 });

    const docRef = db.collection("payments").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return json({ error: "NOT_FOUND" }, { status: 404 });

    const data = snap.data()!;
    // Autorización básica: gestor solo puede ver si lo creó él o si el case le pertenece
    // (mantenemos la política compatible con tus endpoints previos)
    // Nota: asume que GET por id requiere auth (por consistencia con toda la API)
    const creator = String(data.createdBy || "");
    // Si quisieras hacer auth estricta aquí, descomenta y usa getUser + comprobaciones.
    // const user = await getUser(_req);
    // if (!isElevated(user.role)) {
    //   if (creator !== user.uid) {
    //     const caseSnap = await db.collection("cases").doc(String(data.caseId)).get();
    //     if (!caseSnap.exists || caseSnap.get("assignedTo") !== user.uid) {
    //       return json({ error: "FORBIDDEN" }, { status: 403 });
    //     }
    //   }
    // }

    const obj = { id: snap.id, ...serialize(data) };
    const res = json(obj, { status: 200 });
    const etag = etagFromUpdateTime(snap.updateTime as any);
    if (etag) res.headers.set("ETag", etag);
    return res;
  } catch (e) {
    console.error("GET /api/payments/[id] error:", e);
    return json({ error: "INTERNAL" }, { status: 500 });
  }
}

// ---- PATCH /api/payments/[id] ----
export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const user = await getUser(req);
    if (!isElevated(user.role)) {
      return json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const id = ctx.params?.id;
    if (!id) return json({ error: "MISSING_ID" }, { status: 400 });

    const docRef = db.collection("payments").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return json({ error: "NOT_FOUND" }, { status: 404 });

    const current = snap.data()!;
    if (current.reconciled === true) {
      return json({ error: "PAYMENT_RECONCILED" }, { status: 409 });
    }

    // ETag / If-Match (opcional pero recomendado)
    const ifMatch = req.headers.get("if-match");
    const currentEtag = etagFromUpdateTime(snap.updateTime as any);
    if (ifMatch && currentEtag && ifMatch !== currentEtag) {
      return json({ error: "PRECONDITION_FAILED", expected: currentEtag }, { status: 412 });
    }

    // Body & validación
    let body: any = null;
    try {
      body = await req.json();
    } catch {
      return json({ error: "INVALID_JSON" }, { status: 400 });
    }
    if (!body || typeof body !== "object") {
      return json({ error: "INVALID_BODY" }, { status: 400 });
    }

    // Campos permitidos a editar
    const allowed = new Set(["method", "date", "note", "metadata"]);
    const updates: Record<string, any> = {};
    for (const [k, v] of Object.entries(body)) {
      if (allowed.has(k)) {
        if (k === "date") {
          if (!v || isNaN(Date.parse(String(v)))) {
            return json({ error: "VALIDATION", field: "date", message: "ISO date requerida" }, { status: 400 });
          }
          updates.date = new Date(String(v));
        } else if (k === "metadata") {
          if (v && typeof v !== "object") {
            return json({ error: "VALIDATION", field: "metadata", message: "debe ser objeto" }, { status: 400 });
          }
          updates.metadata = v || {};
        } else {
          updates[k] = v;
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return json({ error: "NO_ALLOWED_FIELDS", allow: Array.from(allowed) }, { status: 400 });
    }

    updates.updatedAt = FieldValue.serverTimestamp();

    await docRef.update(updates);

    // Devolver documento actualizado
    const updated = await docRef.get();
    const obj = { id: updated.id, ...serialize(updated.data()) };
    const res = json(obj, { status: 200 });
    const newTag = etagFromUpdateTime(updated.updateTime as any);
    if (newTag) res.headers.set("ETag", newTag);
    return res;
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg === "NO_TOKEN") {
      return withCORS(new NextResponse("Missing Authorization: Bearer <idToken>", { status: 401 }));
    }
    console.error("PATCH /api/payments/[id] error:", e);
    return json({ error: "INTERNAL", detail: "payment_update_failed" }, { status: 500 });
  }
}
