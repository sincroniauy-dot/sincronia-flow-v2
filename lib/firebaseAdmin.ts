// lib/firebaseAdmin.ts  (compat: expone `bucket` y `getBucket`)
// Evita dependencias en tiempo de build: solo tipos, no ejecuta llamadas de red.

import fs from "fs";
import { initializeApp, applicationDefault, cert, App } from "firebase-admin/app";
import { getStorage, Bucket } from "firebase-admin/storage";

let adminApp: App | null = null;

function ensureAdmin(): App {
  if (adminApp) return adminApp;

  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET; // opcional
  // Inicializamos con la mejor credencial disponible.
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    adminApp = initializeApp({ credential: applicationDefault(), storageBucket });
  } else if (fs.existsSync("keys/service-account.json")) {
    const key = JSON.parse(fs.readFileSync("keys/service-account.json", "utf8"));
    adminApp = initializeApp({ credential: cert(key), storageBucket });
  } else {
    // Para CI/typecheck: inicializa vacío (no se usa red en tsc --noEmit)
    adminApp = initializeApp();
  }
  return adminApp;
}

/** Preferido: úsalo en código nuevo */
export function getBucket(): Bucket {
  ensureAdmin();
  const name =
    process.env.FIREBASE_STORAGE_BUCKET || "crm-sincro-v2.firebasestorage.app";
  return getStorage().bucket(name);
}

/** Compatibilidad con código viejo que hacía: `import { bucket } from '@/lib/firebaseAdmin'` */
export const bucket: Bucket = (() => {
  try {
    return getBucket();
  } catch {
    // @ts-expect-error: fallback dummy para typecheck; nunca se usa en runtime de CI
    return {};
  }
})();
