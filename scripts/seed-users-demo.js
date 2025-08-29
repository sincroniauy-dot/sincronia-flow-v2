// scripts/seed-users-demo.js (CommonJS)
require('dotenv').config();
const admin = require('firebase-admin');

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT not set');
  let obj;
  try { obj = JSON.parse(raw); }
  catch { obj = JSON.parse(raw.trim().replace(/^"+|"+$/g, '')); }
  if (typeof obj.private_key === 'string') obj.private_key = obj.private_key.replace(/\\n/g, '\n');
  return obj;
}

async function main() {
  const sa = getServiceAccount();
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
  const auth = admin.auth();
  const db = admin.firestore();

  const users = [
    { email: 'demo.admin@sincronia.test',     password: 'AdminDemo#2025',     displayName: 'Demo Admin',      role: 'admin' },
    { email: 'demo.supervisor@sincronia.test',password: 'Supervisor#2025',   displayName: 'Demo Supervisor', role: 'supervisor' },
    { email: 'demo.gestor1@sincronia.test',   password: 'Gestor1#2025',      displayName: 'Demo Gestor 1',   role: 'gestor' },
    { email: 'demo.gestor2@sincronia.test',   password: 'Gestor2#2025',      displayName: 'Demo Gestor 2',   role: 'gestor' },
  ];

  for (const u of users) {
    let uid;
    // crear/obtener en Auth
    try {
      const rec = await auth.getUserByEmail(u.email);
      uid = rec.uid;
      console.log(`= Auth ya existe: ${u.email}`);
    } catch {
      const rec = await auth.createUser({
        email: u.email, password: u.password, displayName: u.displayName, emailVerified: true, disabled: false
      });
      uid = rec.uid;
      console.log(`➕ Auth creado: ${u.email} (${uid})`);
    }

    // set custom claims (rol)
    await auth.setCustomUserClaims(uid, { role: u.role, demo: true });

    // upsert en Firestore (colección users)
    await db.collection('users').doc(uid).set({
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      active: true,
      demo: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`✔️  Firestore users upsert: ${u.email} (role=${u.role})`);
  }

  console.log('✅ Seed de usuarios demo completado.');
  process.exit(0);
}

main().catch(err => { console.error('❌ Error en seed users:', err); process.exit(1); });
