// scripts/set-user-role.js
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

(function main() {
  const email = process.argv[2];
  const role  = process.argv[3] || "gestor";
  if (!email) {
    console.error("Uso: node -r dotenv/config scripts/set-user-role.js <email> <role>");
    process.exit(1);
  }

  const sa = getServiceAccountFromEnv();
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  }

  admin.auth().getUserByEmail(email)
    .then(user => admin.auth().setCustomUserClaims(user.uid, { role }))
    .then(() => console.log(`OK. Set role='${role}' for ${email}`))
    .catch(err => { console.error(err); process.exit(1); });
})();
