import { getApps, initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

type ServiceAccount = { project_id?: string; client_email?: string; private_key?: string };

function readServiceAccountFromEnv(): ServiceAccount | null {
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!svc) return null;
  try {
    const sa = JSON.parse(svc) as ServiceAccount;
    if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
    return sa;
  } catch (e: any) {
    console.warn("[firebaseAdmin] FIREBASE_SERVICE_ACCOUNT inválido:", e?.message);
    return null;
  }
}

function resolveCredential(): { mode: string; cred: any } {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return { mode: "ADC(FILE)", cred: applicationDefault() };
  }
  const sa = readServiceAccountFromEnv();
  if (sa?.client_email && sa.private_key) {
    return { mode: "SERVICE_ACCOUNT(inline)", cred: cert(sa as any) };
  }
  return { mode: "ADC()", cred: applicationDefault() };
}

// --- Normalizador de bucket ---
function normalizeBucketName(name?: string): string | undefined {
  if (!name) return name;
  const trimmed = name.trim();
  if (trimmed.endsWith(".appspot.com")) {
    return trimmed.replace(/\.appspot\.com$/, ".firebasestorage.app");
  }
  return trimmed;
}

// Fallback duro correcto
const FALLBACK_BUCKET = "crm-sincro-v2.firebasestorage.app";

// Lee env y normaliza
const ENV_BUCKET_RAW = process.env.FIREBASE_STORAGE_BUCKET || "";
const ENV_BUCKET = normalizeBucketName(ENV_BUCKET_RAW) || "";

// Decide bucket final
const bucketName = ENV_BUCKET || FALLBACK_BUCKET;

const { mode, cred } = resolveCredential();

const app =
  getApps()[0] ||
  initializeApp({
    credential: cred,
    storageBucket: bucketName, // default bucket del app
  });

export const db = getFirestore(app);
export const auth = getAuth(app);
// IMPORTANTÍSIMO: abrir el bucket CON EL NOMBRE RESUELTO (normalizado)
export const bucket = getStorage(app).bucket(bucketName);

// Logs de diagnóstico
console.log("[firebaseAdmin] ENV_BUCKET_RAW =", ENV_BUCKET_RAW || "(vacío)");
console.log("[firebaseAdmin] ENV_BUCKET_NORM =", ENV_BUCKET || "(vacío)");
console.log("[firebaseAdmin] FALLBACK       =", FALLBACK_BUCKET);
console.log("[firebaseAdmin] using          =", bucketName);
console.log("[firebaseAdmin] actual bucket.name =", (bucket as any).name);

// --- Compat (usado por rutas antiguas/tests): export del app y helper ---
export { app };
export function getAdminApp() {
  return app;
}
