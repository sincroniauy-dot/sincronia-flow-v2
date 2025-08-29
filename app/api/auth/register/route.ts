// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import admin from "firebase-admin";
// ⚠️ Import por RUTA RELATIVA (desde app/api/auth/register/route.ts hasta lib/firebaseAdmin.ts)
import { getAdminApp } from "../../../../lib/firebaseAdmin";

type Body = {
  email: string;
  password: string;
  displayName?: string;
  role?: "gestor" | "supervisor" | "admin";
};

export async function POST(req: NextRequest) {
  try {
    const data = (await req.json()) as Body;

    if (!data.email || !data.password) {
      return NextResponse.json(
        { ok: false, error: "email y password son obligatorios" },
        { status: 400 }
      );
    }

    // Inicializa (o reutiliza) el Admin SDK
    getAdminApp();

    // Crea el usuario en Firebase Auth
    const user = await admin.auth().createUser({
      email: data.email,
      password: data.password,
      displayName: data.displayName ?? undefined,
      disabled: false,
    });

    // Asigna rol (custom claim). Por defecto "gestor"
    const role = data.role ?? "gestor";
    await admin.auth().setCustomUserClaims(user.uid, { role });

    return NextResponse.json({ ok: true, uid: user.uid, role });
  } catch (err: any) {
    console.error("register error", err);
    const msg = err?.errorInfo?.message || err?.message || "unknown";
    const code = err?.errorInfo?.code;
    const status = /EMAIL_EXISTS/i.test(msg) ? 409 : 500;
    return NextResponse.json({ ok: false, error: msg, code }, { status });
  }
}
