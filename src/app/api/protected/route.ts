// app/api/protected/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "../../../lib/Auth/requireAuth";

export async function GET(req: NextRequest) {
  try {
    const ctx = await verifyAuth(req); // usa getAdminApp() adentro
    if (!ctx) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    return NextResponse.json({ ok: true, uid: ctx.uid, email: ctx.email, role: ctx.role });
  } catch (err: any) {
    // devolvemos el mensaje de error para evitar 500 opaco
    return NextResponse.json({ ok: false, code: "INTERNAL", message: err?.message || String(err) }, { status: 500 });
  }
}
