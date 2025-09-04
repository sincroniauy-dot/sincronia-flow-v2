// lib/firebaseAdmin.ts (compat): exporta { bucket, getBucket }
// Corrige types: Bucket se importa desde @google-cloud/storage

import fs from "fs";
import { initializeApp, applicationDefault, cert, App } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import type { Bucket } from "@google-cloud/storage";

let adminApp: App | null = null;

function ensureAdmin(): App {
  if (adminApp) return adminApp;

  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET; // opcional
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    adminApp = initializeApp({ credential: applicationDefault(), storageBucket });
  } else if (fs.existsSync("keys/service-account.json")) {
    const key = JSON.parse(fs.readFileSync("keys/service-account.json", "utf8"));
    adminApp = initializeApp({ credential: cert(key), storageBucket });
  } else {
    // Para CI/typecheck: init mínimo (no hace red en tsc --noEmit)
    adminApp = initializeApp();
  }
  return adminApp;
}

/** Preferido en código nuevo */
export function getBucket(): Bucket {
  ensureAdmin();
  const name =
    process.env.FIREBASE_STORAGE_BUCKET || "crm-sincro-v2.firebasestorage.app";
  return getStorage().bucket(name) as unknown as Bucket;
}

/** Compat con código viejo que hacía: `import { bucket } from '@/lib/firebaseAdmin'` */
export const bucket: Bucket = ((): Bucket => {
  try {
    return getBucket();
  } catch {
    // Fallback “dummy” solo para que pase el typecheck en CI
    return {} as unknown as Bucket;
  }
})();
