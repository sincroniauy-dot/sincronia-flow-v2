const { getApps, initializeApp, applicationDefault, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

function buildCredential() {
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (svc) {
    const sa = JSON.parse(svc);
    sa.private_key = sa.private_key.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
    return cert(sa);
  }
  return applicationDefault();
}

const app = getApps()[0] || initializeApp({ credential: buildCredential() });
const db = getFirestore(app);

(async () => {
  const id = process.env.CANCELLATION_ID || "demo-cancel-001";
  await db.collection("cancellations").doc(id).set({
    caseId: "case-demo-001",
    paymentId: "pay-demo-001",
    requesterName: "Juan Pérez",
    requesterEmail: "juan@example.com",
    reason: "Cancelación de prueba",
    amount: 1000,
    currency: "UYU",
    createdAt: new Date(),
    updatedAt: new Date(),
  }, { merge: true });
  console.log("Seed OK:", id);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });