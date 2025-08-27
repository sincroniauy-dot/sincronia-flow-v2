// lib/firebaseAdmin.ts
import admin from "firebase-admin";

let app: admin.app.App | undefined;

function getServiceAccountFromEnv() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT not set");
  try {
    // Viene como una sola línea. Parseamos a objeto:
    return JSON.parse(raw);
  } catch (e) {
    // Si alguien pegó comillas de más, intentamos limpiar:
    const cleaned = raw.trim().replace(/^"+|"+$/g, "");
    return JSON.parse(cleaned);
  }
}

export function getAdminApp() {
  if (app) return app;
  if (admin.apps.length) {
    app = admin.app();
    return app;
  }
  const sa = getServiceAccountFromEnv();

  // Evita “duplicate app” en dev hot-reload
  app = admin.initializeApp({
    credential: admin.credential.cert(sa as admin.ServiceAccount),
  });
  return app;
}

export function getFirestore() {
  return getAdminApp().firestore();
}
