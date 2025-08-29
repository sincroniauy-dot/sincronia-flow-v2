// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import admin from "firebase-admin";
import { getAdminApp } from "../../../../lib/firebaseAdmin";

type Body = {
  email: string;
};

export async function POST(req: NextRequest) {
  try {
    const data = (await req.json()) as Body;

    if (!data.email) {
      return NextResponse.json(
        { ok: false, error: "email es obligatorio" },
        { status: 400 }
      );
    }

    // Inicializa (o recupera) Admin SDK
    getAdminApp();

    // Buscar usuario por email
    const user = await admin.auth().getUserByEmail(data.email);

    // Rol (si existe) o "gestor"
    const role =
      (user.customClaims && (user.customClaims as any).role) || "gestor";

    // Custom token (solo para pruebas en dev)
    const customToken = await admin.auth().createCustomToken(user.uid, { role });

    return NextResponse.json({ ok: true, uid: user.uid, role, customToken });
  } catch (err: any) {
    console.error("login error", err);
    const msg = err?.errorInfo?.message || err?.message || "unknown";
    const status = /NOT_FOUND/i.test(msg) ? 404 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
