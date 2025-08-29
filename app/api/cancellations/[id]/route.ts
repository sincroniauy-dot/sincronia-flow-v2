// app/api/cancellations/[id]/route.ts
import "@/lib/firebaseAdmin";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const db = getFirestore();

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

// GET /api/cancellations/[id]
export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const id = ctx.params?.id;
    if (!id) return json({ error: "MISSING_ID" }, { status: 400 });

    const ref = db.collection("cancellations").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return json({ error: "NOT_FOUND" }, { status: 404 });

    return json({ id: snap.id, ...serialize(snap.data()) }, { status: 200 });
  } catch (e) {
    console.error("GET /api/cancellations/[id] error:", e);
    return json({ error: "INTERNAL" }, { status: 500 });
  }
}
