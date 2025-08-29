// tests/setup.ts
import "dotenv/config";

const missing: string[] = [];
if (!process.env.FIREBASE_SERVICE_ACCOUNT) missing.push("FIREBASE_SERVICE_ACCOUNT");
if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) missing.push("NEXT_PUBLIC_FIREBASE_API_KEY");
if (missing.length) {
  throw new Error(
    `Faltan variables en .env: ${missing.join(", ")}. ` +
      `Asegurate de tener el service account en una sola línea (\\n en private_key) y la API key.`
  );
}
