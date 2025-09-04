// lib/firebaseAdmin.ts
import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

function init() {
  if (getApps().length) return;
  // Si tenés GOOGLE_APPLICATION_CREDENTIALS, usamos applicationDefault().
  // Si preferís archivo, también soporta keys/service-account.json.
  try {
    const hasEnv = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (hasEnv) {
      initializeApp({ credential: applicationDefault() });
      return;
    }
    // fallback por si la env no está pero existe el archivo
    const keyPath = 'keys/service-account.json';
    if (fs.existsSync(keyPath)) {
      const key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
      initializeApp({ credential: cert(key) });
      return;
    }
    throw new Error('No hay credenciales para firebase-admin');
  } catch (e) {
    console.error('[firebase-admin] init error:', (e as any)?.message);
    throw e;
  }
}

export function db() {
  init();
  return getFirestore();
}
