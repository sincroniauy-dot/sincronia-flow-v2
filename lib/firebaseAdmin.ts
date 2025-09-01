import fs from "fs";
import { getApps, initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

type SA = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

function readServiceAccountFromFile(path: string): SA | null {
  try {
    if (fs.existsSync(path)) {
      const raw = fs.readFileSync(path, "utf8");
      const sa = JSON.parse(raw) as SA;
      if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
      return sa;
    }
  } catch {}
  return null;
}

function resolveBucketName(): string {
  if (process.env.FIREBASE_STORAGE_BUCKET) return process.env.FIREBASE_STORAGE_BUCKET;
  // Intentar deducir desde FIREBASE_SERVICE_ACCOUNT
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (svc) {
    try {
      const sa: SA = JSON.parse(svc);
      if (sa.project_id) return `${sa.project_id}.appspot.com`;
    } catch {}
  }
  // Intentar deducir desde GOOGLE_APPLICATION_CREDENTIALS (archivo)
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath) {
    const sa = readServiceAccountFromFile(credPath);
    if (sa?.project_id) return `${sa.project_id}.appspot.com`;
  }
  throw new Error(
    "FIREBASE_STORAGE_BUCKET no definido y no se pudo deducir project_id. " +
    "Define FIREBASE_STORAGE_BUCKET o configura FIREBASE_SERVICE_ACCOUNT/GOOGLE_APPLICATION_CREDENTIALS con project_id."
  );
}

function buildCredential() {
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (svc) {
    let sa: SA;
    try {
      sa = JSON.parse(svc);
    } catch (e: any) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT no es JSON válido: " + e?.message);
    }
    if (!sa.private_key || !sa.client_email) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT incompleto: falta private_key o client_email.");
    }
    sa.private_key = sa.private_key.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
    return cert(sa as any);
  }
  // Si no hay inline, intentar ADC (GOOGLE_APPLICATION_CREDENTIALS)
  return applicationDefault();
}

const app = getApps()[0] || initializeApp({
  credential: buildCredential(),
  storageBucket: resolveBucketName(),
});

export const db = getFirestore(app);
export const auth = getAuth(app);
export const bucket = getStorage(app).bucket();