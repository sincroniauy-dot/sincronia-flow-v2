// lib/firebaseAdmin.ts
// Inicializa Firebase Admin una sola vez al importarlo.
// Requiere FIREBASE_SERVICE_ACCOUNT en .env (JSON en UNA LÍNEA; private_key con \n).

import { getApps, initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function initAdmin() {
  if (getApps().length) return; // ya inicializado

  const svcJSON = process.env.FIREBASE_SERVICE_ACCOUNT;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID; // opcional como fallback

  if (!svcJSON) {
    initializeApp({ credential: applicationDefault() });
    return;
  }

  let svc: any;
  try {
    svc = JSON.parse(svcJSON);
  } catch (e) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT no es un JSON válido (una sola línea).");
  }

  const privateKey = String(svc.private_key || "").replace(/\\n/g, "\n");
  const clientEmail = svc.client_email;
  const pid = svc.project_id || projectId;

  if (!privateKey || !clientEmail || !pid) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT incompleto: se requieren project_id, client_email y private_key.");
  }

  initializeApp({
    credential: cert({
      projectId: pid,
      clientEmail,
      privateKey,
    }),
  });
}

initAdmin();

export const adminDb = getFirestore();
export const adminAuth = getAuth();
