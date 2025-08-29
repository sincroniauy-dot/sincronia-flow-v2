// app/api/agreements/[id]/route.ts
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
  "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, If-Match",
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

function etagFromUpdateTime(updateTime?: FirebaseFirestore.Timestamp) {
  return updateTime ? `"${updateTime.toMillis()}"` : undefined;
}

// GET /api/agreements/[id]
export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const id = ctx.params?.id;
    if (!id) return json({ error: "MISSING_ID" }, { status: 400 });

    const docRef = db.collection("agreements").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return json({ error: "NOT_FOUND" }, { status: 404 });

    const res = json({ id: snap.id, ...serialize(snap.data()) }, { status: 200 });
    const tag = etagFromUpdateTime(snap.updateTime as any);
    if (tag) res.headers.set("ETag", tag);
    return res;
  } catch (e) {
    console.error("GET /api/agreements/[id] error:", e);
    return json({ error: "INTERNAL" }, { status: 500 });
  }
}

// PATCH /api/agreements/[id]
export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const user = await getUser(req);
    if (!isElevated(user.role)) return json({ error: "FORBIDDEN" }, { status: 403 });

    const id = ctx.params?.id;
    if (!id) return json({ error: "MISSING_ID" }, { status: 400 });

    const docRef = db.collection("agreements").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return json({ error: "NOT_FOUND" }, { status: 404 });

    const current = snap.data()!;

    // ETag
    const ifMatch = req.headers.get("if-match");
    const currentTag = etagFromUpdateTime(snap.updateTime as any);
    if (ifMatch && currentTag && ifMatch !== currentTag) {
      return json({ error: "PRECONDITION_FAILED", expected: currentTag }, { status: 412 });
    }

    // Parse body
    let body: any = null;
    try {
      body = await req.json();
    } catch {
      return json({ error: "INVALID_JSON" }, { status: 400 });
    }
    if (!body || typeof body !== "object") return json({ error: "INVALID_BODY" }, { status: 400 });

    // Campos permitidos
    const allowed = new Set(["terms", "status"]);
    const updates: Record<string, any> = {};

    // status transitions
    if ("status" in body) {
      const next = String(body.status);
      if (!["active", "cancelled", "completed"].includes(next)) {
        return json({ error: "VALIDATION", field: "status", allow: ["active","cancelled","completed"] }, { status: 400 });
      }
      if (current.status !== next) {
        updates.status = next;
        if (next === "cancelled") updates.cancelledAt = FieldValue.serverTimestamp();
        if (next === "completed") updates.completedAt = FieldValue.serverTimestamp();
      }
    }

    if ("terms" in body) {
      const v = body.terms;
      if (v && typeof v !== "object") {
        return json({ error: "VALIDATION", field: "terms", message: "debe ser objeto" }, { status: 400 });
      }
      updates.terms = v || {};
    }

    // Inmutables
    for (const k of ["amount", "startDate", "installments"]) {
      if (k in body) {
        return json({ error: "IMMUTABLE_FIELD", field: k }, { status: 400 });
      }
    }

    if (Object.keys(updates).length === 0) {
      return json({ error: "NO_ALLOWED_FIELDS", allow: Array.from(allowed) }, { status: 400 });
    }

    updates.updatedAt = FieldValue.serverTimestamp();

    await docRef.update(updates);
    await writeAudit({
      entity: "agreement",
      entityId: id,
      action: "update",
      by: user.uid,
      diff: updates,
    });

    const updated = await docRef.get();
    const res = json({ id: updated.id, ...serialize(updated.data()) }, { status: 200 });
    const tag = etagFromUpdateTime(updated.updateTime as any);
    if (tag) res.headers.set("ETag", tag);
    return res;
  } catch (e: any) {
    if (String(e?.message) === "NO_TOKEN") {
      return withCORS(new NextResponse("Missing Authorization", { status: 401 }));
    }
    console.error("PATCH /api/agreements/[id] error:", e);
    return json({ error: "INTERNAL" }, { status: 500 });
  }
}
