// app/api/auth/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/requireAuth";

export async function GET(req: NextRequest) {
  const ctx = await verifyAuth(req);
  if (!ctx) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    uid: ctx.uid,
    email: ctx.email,
    role: ctx.role ?? null,
    claims: ctx.claims,
  });
}
