// scripts/get-signed-url.js
require('dotenv').config({ path: '.env.local' });
const { Storage } = require('@google-cloud/storage');

const projectId = process.env.FIREBASE_PROJECT_ID;
let bucketName = (process.env.FIREBASE_STORAGE_BUCKET || '').trim();
if (bucketName.endsWith('.appspot.com')) {
  bucketName = bucketName.replace(/\.appspot\.com$/i, '.firebasestorage.app');
}

// Uso: node scripts/get-signed-url.js documents/cancellation/<docId>.pdf
const objectPath = process.argv[2];
if (!objectPath) {
  console.error('Uso: node scripts/get-signed-url.js <ruta_del_objeto_en_bucket>');
  process.exit(1);
}

(async () => {
  try {
    const storage = new Storage({ projectId, keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS });
    const [url] = await storage.bucket(bucketName).file(objectPath).getSignedUrl({
      version: 'v4', action: 'read', expires: Date.now() + 30 * 60 * 1000
    });
    // ⬇️ Imprime SOLO la URL (sin prefijo) para que type/start no fallen
    process.stdout.write(url);
  } catch (err) {
    console.error('Error generando URL firmada:', err.message);
    process.exit(1);
  }
})();
