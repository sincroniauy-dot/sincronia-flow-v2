// app/api/health/route.ts
import { NextResponse } from "next/server";
import { getFirestore } from "../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const t0 = Date.now();
  try {
    const db = getFirestore();
    // Usar colección normal (no __reservados__)
    await db.doc("health/ping").get();
    const latencyMs = Date.now() - t0;
    return NextResponse.json({ ok: true, firestore: "connected", latencyMs });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, firestore: "error", message: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
