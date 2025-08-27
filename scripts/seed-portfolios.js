// scripts/seed-portfolios.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT not set');
  let obj;
  try { obj = JSON.parse(raw); }
  catch { obj = JSON.parse(raw.trim().replace(/^"+|"+$/g, "")); }
  if (typeof obj.private_key === 'string') {
    obj.private_key = obj.private_key.replace(/\\n/g, '\n');
  }
  return obj;
}

function slugify(s) {
  return s
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

async function main() {
  const sa = getServiceAccount();
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  }
  const db = admin.firestore();

  const file = path.join(__dirname, '..', 'data', 'portfolios.txt');
  if (!fs.existsSync(file)) {
    throw new Error(`No se encontró ${file}. Crea data\\portfolios.txt primero.`);
  }

  const lines = fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  console.log(`Encontradas ${lines.length} líneas. Importando...`);

  const clientCache = new Map(); // nombre -> { id, slug }

  for (const line of lines) {
    const parts = line.split(/\s*-\s*/);
    if (parts.length < 2) {
      console.warn(`⚠️ Línea ignorada (no tiene "Cliente - Cartera"): "${line}"`);
      continue;
    }
    const clientName = parts[0].trim();
    const portfolioName = parts.slice(1).join(' - ').trim();

    // 1) Asegurar cliente
    let clientDoc = clientCache.get(clientName);
    if (!clientDoc) {
      const q = await db.collection('clients').where('name', '==', clientName).limit(1).get();
      let clientId;
      if (!q.empty) {
        clientId = q.docs[0].id;
      } else {
        const clientRef = await db.collection('clients').add({
          name: clientName,
          slug: slugify(clientName),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          active: true
        });
        clientId = clientRef.id;
        console.log(`➕ Cliente creado: ${clientName} (${clientId})`);
      }
      clientDoc = { id: clientId, slug: slugify(clientName) };
      clientCache.set(clientName, clientDoc);
    }

    // 2) Asegurar cartera (evitar duplicados)
    const existing = await db.collection('portfolios')
      .where('clientId', '==', clientDoc.id)
      .where('name', '==', portfolioName)
      .limit(1)
      .get();

    if (!existing.empty) {
      console.log(`= Cartera ya existente: ${clientName} - ${portfolioName}`);
      continue;
    }

    const portfolioRef = await db.collection('portfolios').add({
      clientId: clientDoc.id,
      clientName,
      name: portfolioName,
      slug: slugify(`${clientName}-${portfolioName}`),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      active: true
    });

    console.log(`➕ Cartera creada: ${clientName} - ${portfolioName} (${portfolioRef.id})`);
  }

  console.log('✅ Importación terminada.');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error en seed:', err);
  process.exit(1);
});
