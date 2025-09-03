// lib/firebaseAdmin.ts
import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { getFirestore } from "firebase-admin/firestore";

type AdminEnv = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  storageBucket?: string;
};

function readFromEnv(): AdminEnv | null {
  const projectId = process.env.FIREBASE_PROJECT_ID || "";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || "";
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || "";

  // Soporte para claves con saltos escapados
  if (privateKey.includes("\\n")) privateKey = privateKey.replace(/\\n/g, "\n");

  if (projectId && clientEmail && privateKey) {
    return {
      projectId,
      clientEmail,
      privateKey,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined,
    };
  }
  return null;
}

let cachedApp: App | null = null;

export function getAdminApp(): App | null {
  if (cachedApp) return cachedApp;

  const cfg = readFromEnv();

  // 1) Intentar con variables de entorno (server/CI recomendado)
  try {
    if (!getApps().length && cfg) {
      cachedApp = initializeApp({
        credential: cert({
          projectId: cfg.projectId,
          clientEmail: cfg.clientEmail,
          privateKey: cfg.privateKey,
        }),
        storageBucket: cfg.storageBucket,
      });
      return cachedApp;
    }
  } catch (e) {
    console.error("firebaseAdmin: fallo init con FIREBASE_*:", e);
  }

  // 2) Fallback a ADC (GOOGLE_APPLICATION_CREDENTIALS) si existe
  try {
    if (!getApps().length) {
      cachedApp = initializeApp();
    }
  } catch (e) {
    console.error("firebaseAdmin: fallo init con ADC:", e);
  }

  return getApps()[0] ?? null;
}

export const adminApp = getAdminApp();

// Exportar laxo para no romper si no hay Admin en local
export const db: any = adminApp ? getFirestore(adminApp) : null;

export const bucket: any = (() => {
  try {
    if (!adminApp) return null;
    const name = process.env.FIREBASE_STORAGE_BUCKET;
    return name ? getStorage(adminApp).bucket(name) : getStorage(adminApp).bucket();
  } catch {
    return null;
  }
})();
