// scripts/seed-demo.js
// Ejecuta: node -r dotenv/config .\scripts\seed-demo.js
// Requiere: FIREBASE_SERVICE_ACCOUNT en .env (una línea), NEXT_PUBLIC_FIREBASE_PROJECT_ID opcional
const admin = require('firebase-admin');

function initAdmin() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.error("FIREBASE_SERVICE_ACCOUNT faltante en .env");
    process.exit(1);
  }
  const svc = JSON.parse(raw);
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: svc.project_id,
        clientEmail: svc.client_email,
        privateKey: svc.private_key.replace(/\\n/g, '\n'),
      }),
    });
  }
  return admin.firestore();
}

function randPick(arr) { return arr[Math.floor(Math.random()*arr.length)]; }

async function main() {
  const db = initAdmin();

  const testerUid = process.argv[2] || null; // opcional: pasar UID para assignedTo
  if (!testerUid) {
    console.log("Tip: podés pasar UID para assignedTo, ej: node -r dotenv/config scripts/seed-demo.js hGyufu...");
  }

  // Crear N casos
  const N = 5;
  const clientIds = ["client_demo_1", "client_demo_2", "client_demo_3"];
  const debtorNames = ["Juan Pérez", "María Gómez", "Carlos López", "Ana Silva", "Luis Torres"];

  const now = admin.firestore.FieldValue.serverTimestamp();
  const createdCases = [];

  for (let i = 0; i < N; i++) {
    const ref = db.collection("cases").doc();
    const assignedTo = testerUid || "unassigned";
    const balance = 500 + Math.floor(Math.random() * 1000);

    await ref.set({
      clientId: randPick(clientIds),
      debtorName: debtorNames[i % debtorNames.length],
      assignedTo,
      status: "open",
      balance,
      createdAt: now,
      updatedAt: now,
    });
    createdCases.push({ id: ref.id, balance });
  }

  // Para cada case, crear M pagos (y ajustar balance en transacción)
  const methods = ["cash", "transfer", "card"];
  const M = 3;

  for (const cs of createdCases) {
    for (let j = 0; j < M; j++) {
      await db.runTransaction(async (tx) => {
        const caseRef = db.collection("cases").doc(cs.id);
        const caseSnap = await tx.get(caseRef);
        if (!caseSnap.exists) return;

        const prev = Number(caseSnap.get("balance") || 0);
        const amount = Math.min(100 + Math.floor(Math.random() * 200), prev);
        const newBalance = Math.max(prev - amount, 0);
        const now = admin.firestore.FieldValue.serverTimestamp();

        const payRef = db.collection("payments").doc();
        tx.set(payRef, {
          caseId: cs.id,
          amount,
          method: randPick(methods),
          date: new Date(),
          createdBy: testerUid || "seed-script",
          status: "posted",
          createdAt: now,
          updatedAt: now,
        });

        tx.update(caseRef, { balance: newBalance, updatedAt: now });
      });
    }
  }

  console.log(`Seeds creados: ${createdCases.length} casos x ${M} pagos.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
