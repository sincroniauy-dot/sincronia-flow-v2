import { getApps, initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function buildCredential() {
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (svc) {
    let sa: ServiceAccount;
    try {
      sa = JSON.parse(svc);
    } catch (e: any) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT no es JSON válido: " + e?.message);
    }
    if (!sa.private_key || !sa.client_email) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT incompleto: falta private_key o client_email.");
    }
    // Normalizar \n a saltos reales y CRLF → LF
    sa.private_key = sa.private_key.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
    return cert(sa as any);
  }
  // Si no hay FIREBASE_SERVICE_ACCOUNT, usar ADC (GOOGLE_APPLICATION_CREDENTIALS ya lo setaste)
  return applicationDefault();
}

const app = getApps()[0] || initializeApp({
  credential: buildCredential(),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
});

export const db = getFirestore(app);
export const auth = getAuth(app);
export const bucket = getStorage(app).bucket();