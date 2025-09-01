import { NextRequest } from "next/server";
import { auth } from "./firebaseAdmin";

export class AuthError extends Error {
  status: number;
  details?: any;
  constructor(message: string, status = 401, details?: any) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function requireAuth(req: NextRequest) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.substring(7) : "";
  if (!token) {
    throw new AuthError("Missing Bearer token", 401);
  }
  try {
    const decoded = await auth.verifyIdToken(token, true);
    return decoded; // contiene uid, email, etc.
  } catch (err: any) {
    throw new AuthError("Invalid ID token", 401, err?.message || err);
  }
}
