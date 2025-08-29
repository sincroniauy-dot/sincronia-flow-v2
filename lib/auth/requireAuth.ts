// lib/auth/requireAuth.ts
import { NextRequest } from "next/server";
import { getAdminApp } from "../firebaseAdmin"; // <— ruta relativa (sin alias)

type Role = "gestor" | "supervisor" | "admin";

export type AuthContext = {
  uid: string;
  email?: string;
  role?: Role;
  claims: Record<string, any>;
};

export function getBearer(req: NextRequest) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

export async function verifyAuth(req: NextRequest): Promise<AuthContext | null> {
  try {
    const token = getBearer(req);
    if (!token) return null;

    const app = getAdminApp();
    const decoded = await app.auth().verifyIdToken(token, true);
    const role = (decoded.role as Role | undefined) ?? undefined;

    return {
      uid: decoded.uid,
      email: decoded.email ?? undefined,
      role,
      claims: decoded,
    };
  } catch {
    return null;
  }
}

export function requireRole(ctx: AuthContext | null, roles: Role[]) {
  if (!ctx) return { ok: false, status: 401, error: "UNAUTHENTICATED" as const };
  if (!ctx.role || !roles.includes(ctx.role)) {
    return { ok: false, status: 403, error: "FORBIDDEN" as const };
  }
  return { ok: true as const };
}
