// scripts/open-signed-url.js
require('dotenv').config({ path: '.env.local' });
const { Storage } = require('@google-cloud/storage');
const { exec } = require('child_process');

const projectId = process.env.FIREBASE_PROJECT_ID;
let bucketName = (process.env.FIREBASE_STORAGE_BUCKET || '').trim();
if (bucketName.endsWith('.appspot.com')) {
  bucketName = bucketName.replace(/\.appspot\.com$/i, '.firebasestorage.app');
}

// Uso: node scripts/open-signed-url.js documents/cancellation/<docId>.pdf
const objectPath = process.argv[2];
if (!objectPath) {
  console.error('Uso: node scripts/open-signed-url.js <ruta_del_objeto_en_bucket>');
  process.exit(1);
}

(async () => {
  try {
    const storage = new Storage({ projectId, keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS });
    const options = { version: 'v4', action: 'read', expires: Date.now() + 30 * 60 * 1000 }; // 30 min
    const [url] = await storage.bucket(bucketName).file(objectPath).getSignedUrl(options);
    console.log('URL firmada (30 min):\n' + url);

    // Abrir en el navegador por defecto (Windows)
    const cmd = `start "" "${url}"`;
    exec(cmd, (err) => {
      if (err) console.error('No pude abrir el navegador automáticamente:', err.message);
    });
  } catch (err) {
    console.error('Error generando/abriendo URL firmada:', err.message);
    process.exit(1);
  }
})();
