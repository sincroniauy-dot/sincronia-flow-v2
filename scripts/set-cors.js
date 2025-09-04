// scripts/set-cors.js
require('dotenv').config({ path: '.env.local' });
const { Storage } = require('@google-cloud/storage');

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
let bucketName = (process.env.FIREBASE_STORAGE_BUCKET || 'crm-sincro-v2.firebasestorage.app').trim();
if (bucketName.endsWith('.appspot.com')) {
  bucketName = bucketName.replace(/\.appspot\.com$/i, '.firebasestorage.app');
}

(async () => {
  try {
    const storage = new Storage({
      projectId,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });

    console.log(`ProjectId: ${projectId}`);
    console.log(`Bucket: ${bucketName}`);

    const corsConfiguration = [
      {
        origin: ['http://localhost:3000'],
        method: ['GET', 'HEAD'],
        maxAgeSeconds: 3600,
        responseHeader: ['Content-Type'],
      },
    ];

    await storage.bucket(bucketName).setCorsConfiguration(corsConfiguration);
    const [meta] = await storage.bucket(bucketName).getMetadata();

    console.log('✅ CORS aplicado. Config actual:');
    console.log(JSON.stringify(meta.cors, null, 2));
  } catch (err) {
    console.error('Error aplicando CORS:', err.message);
    process.exit(1);
  }
})();
