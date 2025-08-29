// scripts/seed-portfolios.js  (CommonJS)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
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

function slugify(s) {
  return s
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

async function main() {
  // Init Admin
  const sa = getServiceAccount();
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
  const db = admin.firestore();

  // Leer TXT
  const file = path.join(__dirname, '..', 'data', 'portfolios.txt');
  if (!fs.existsSync(file)) throw new Error(`No se encontró ${file}`);
  const lines = fs.readFileSync(file, 'utf8')
    .split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  console.log(`Encontradas ${lines.length} líneas. Importando...`);

  // cache de clientes por nombre
  const clientCache = new Map(); // name -> { id, slug }

  for (const line of lines) {
    const parts = line.split(/\s*-\s*/);
    if (parts.length < 2) {
      console.warn(`⚠️ Línea ignorada (se esperaba "Cliente - Cartera"): "${line}"`);
      continue;
    }
    const clientName = parts[0].trim();
    const portfolioName = parts.slice(1).join(' - ').trim();

    // Asegurar cliente
    let client = clientCache.get(clientName);
    if (!client) {
      const q = await db.collection('clients').where('name', '==', clientName).limit(1).get();
      let clientId;
      if (!q.empty) {
        clientId = q.docs[0].id;
      } else {
        const ref = await db.collection('clients').add({
          name: clientName,
          slug: slugify(clientName),
          active: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        clientId = ref.id;
        console.log(`➕ Cliente creado: ${clientName} (${clientId})`);
      }
      client = { id: clientId, slug: slugify(clientName) };
      clientCache.set(clientName, client);
    }

    // Evitar duplicados de cartera (por cliente + nombre)
    const existing = await db.collection('portfolios')
      .where('clientId', '==', client.id)
      .where('name', '==', portfolioName)
      .limit(1)
      .get();
    if (!existing.empty) {
      console.log(`= Cartera ya existente: ${clientName} - ${portfolioName}`);
      continue;
    }

    // Crear cartera
    const ref = await db.collection('portfolios').add({
      clientId: client.id,
      clientName,
      name: portfolioName,
      slug: slugify(`${clientName}-${portfolioName}`),
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`➕ Cartera creada: ${clientName} - ${portfolioName} (${ref.id})`);
  }

  console.log('✅ Importación terminada.');
  process.exit(0);
}

main().catch(err => { console.error('❌ Error en seed:', err); process.exit(1); });
