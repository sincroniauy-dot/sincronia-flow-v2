// scripts/tickets-reject-latest.js (sin orderBy, ordena en memoria)
require('dotenv/config');
const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

function initAdmin() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    initializeApp({ credential: applicationDefault() });
  } else if (fs.existsSync('keys/service-account.json')) {
    const key = JSON.parse(fs.readFileSync('keys/service-account.json', 'utf8'));
    initializeApp({ credential: cert(key) });
  } else {
    throw new Error('No hay credenciales (GOOGLE_APPLICATION_CREDENTIALS o keys/service-account.json)');
  }
}

async function main() {
  const reason = process.argv.slice(2).join(' ') || 'rechazado sin motivo';
  initAdmin();
  const db = getFirestore();

  // Solo where status == OPEN (sin orderBy) → NO requiere índice
  const snap = await db.collection('tickets')
    .where('status', '==', 'OPEN')
    .limit(200)
    .get();

  if (snap.empty) {
    console.log('No hay tickets OPEN para rechazar.');
    return;
  }

  // Ordenamos en memoria por createdAt desc (ISO string)
  const docs = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  const latest = docs[0];
  const closedAt = new Date().toISOString();

  await db.collection('tickets').doc(latest.id).update({
    status: 'CLOSED',
    closedAt,
    rejected: true,
    rejectReason: reason || null
  });

  console.log('✅ Ticket rechazado:', latest.id, 'caseId:', latest.caseId, 'reason:', reason);
}

main().catch(e => {
  console.error('tickets-reject-latest error:', e.message);
  process.exit(1);
});
