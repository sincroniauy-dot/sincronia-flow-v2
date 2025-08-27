// smoke-admin.js
const admin = require("firebase-admin");

function getSA() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT not set");
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch {
    obj = JSON.parse(raw.trim().replace(/^"+|"+$/g, ""));
  }
  // Si tu private_key viniera con \\n, descomenta esta línea:
  // obj.private_key = obj.private_key.replace(/\\n/g, "\n");
  return obj;
}

const sa = getSA();
admin.initializeApp({ credential: admin.credential.cert(sa) });

(async () => {
  try {
    const db = admin.firestore();
    const t0 = Date.now();
    await db.doc("smokeTest/ping").get();
    console.log("OK Firestore", { latencyMs: Date.now() - t0 });
    process.exit(0);
  } catch (e) {
    console.error("ERROR Firestore:", e.message);
    process.exit(1);
  }
})();
