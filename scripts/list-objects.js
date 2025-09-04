// scripts/list-objects.js
require('dotenv').config({ path: '.env.local' });
const { Storage } = require('@google-cloud/storage');

const projectId = process.env.FIREBASE_PROJECT_ID;
let bucketName = (process.env.FIREBASE_STORAGE_BUCKET || '').trim();
if (bucketName.endsWith('.appspot.com')) {
  bucketName = bucketName.replace(/\.appspot\.com$/i, '.firebasestorage.app');
}

(async () => {
  try {
    const storage = new Storage({ projectId, keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS });
    const [files] = await storage.bucket(bucketName).getFiles({ prefix: 'documents/cancellation/' });
    if (!files.length) {
      console.log('No hay PDFs en documents/cancellation/.');
      return;
    }
    console.log('Archivos encontrados:');
    for (const f of files) console.log(' -', f.name);
  } catch (err) {
    console.error('Error listando objetos:', err.message);
    process.exit(1);
  }
})();
