// app/api/protected/route.ts
import "@/lib/firebaseAdmin";
import { getAuth } from "firebase-admin/auth";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const authz = req.headers.get("authorization") || "";
  if (!authz.startsWith("Bearer ")) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED", detail: "Missing Bearer token" }, { status: 401 });
  }

  const token = authz.slice(7).trim();
  try {
    // checkRevoked=false para diagnóstico; luego podemos poner true
    const decoded = await getAuth().verifyIdToken(token, false);

    const role =
      (decoded as any).role ||
      (((decoded as any).roles && (decoded as any).roles[0]) || "user");

    return NextResponse.json(
      {
        ok: true,
        uid: decoded.uid,
        email: decoded.email,
        role,
        aud: decoded.aud,
        iss: decoded.iss,
        iat: decoded.iat,
        exp: decoded.exp
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("GET /api/protected verifyIdToken error:", e?.errorInfo || e?.message || e);
    const info = (e && (e.errorInfo?.message || e.message)) || "VERIFY_ERROR";
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED", detail: info }, { status: 401 });
  }
}
