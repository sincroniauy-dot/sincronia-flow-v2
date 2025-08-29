// scripts/seed-test-case.js
const admin = require("firebase-admin");

function getServiceAccountFromEnv() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT not set");
  try { return JSON.parse(raw); }
  catch {
    const cleaned = raw.trim().replace(/^"+|"+$/g, "");
    return JSON.parse(cleaned);
  }
}

async function main() {
  const uid = process.argv[2];
  if (!uid) {
    console.error("Uso: node -r dotenv/config scripts/seed-test-case.js <uid>");
    process.exit(1);
  }

  const sa = getServiceAccountFromEnv();
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  }
  const db = admin.firestore();

  const caseRef = db.collection("cases").doc();
  const now = new Date();

  const doc = {
    id: caseRef.id,
    clientId: "client_demo_1",
    assignedTo: uid,          // <- propietario del caso
    status: "open",
    balance: 1000,            // saldo inicial para probar
    createdAt: now,
    updatedAt: now,
  };

  await caseRef.set(doc);
  console.log("OK. Case creado:");
  console.log(JSON.stringify(doc, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
