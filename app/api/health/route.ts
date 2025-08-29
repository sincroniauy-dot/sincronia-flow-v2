// app/api/health/route.ts
import "@/lib/firebaseAdmin";
import { getApps, getApp } from "firebase-admin/app";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const app = getApps().length ? getApp() : null;
    const projectId =
      (app?.options?.credential as any)?.projectId ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      "unknown";

    return NextResponse.json({ ok: true, projectId }, { status: 200 });
  } catch (e) {
    console.error("health error:", e);
    return NextResponse.json({ ok: false, error: "HEALTH_FAIL" }, { status: 500 });
  }
}
