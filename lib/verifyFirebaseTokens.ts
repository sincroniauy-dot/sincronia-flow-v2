// lib/verifyFirebaseToken.ts
import admin from "firebase-admin";
import { getAdminApp } from "./firebaseAdmin";

export type DecodedUser = {
  uid: string;
  email?: string;
  role?: "gestor" | "supervisor" | "admin";
  [k: string]: any;
};

export async function verifyIdTokenFromHeader(authHeader?: string) {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization header");
  }

  const idToken = authHeader.slice("Bearer ".length);
  getAdminApp(); // asegura init del Admin SDK
  const decoded = await admin.auth().verifyIdToken(idToken);

  const out: DecodedUser = {
    uid: decoded.uid,
    email: decoded.email,
    role: (decoded as any).role ?? "gestor",
    ...decoded,
  };
  return out;
}
