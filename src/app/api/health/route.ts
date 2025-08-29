// app/api/health/route.ts
import { NextResponse } from "next/server";
import { getAdminApp } from "../../../lib/firebaseAdmin";

export async function GET() {
  try {
    const app = getAdminApp();
    const projectId = app.options?.projectId || "unknown";
    return NextResponse.json({ ok: true, projectId });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err?.message || String(err) }, { status: 500 });
  }
}
