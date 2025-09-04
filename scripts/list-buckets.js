// scripts/list-buckets.js
require('dotenv').config({ path: '.env.local' });
const { Storage } = require('@google-cloud/storage');

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
const rawBucket = process.env.FIREBASE_STORAGE_BUCKET;

// Normaliza el bucket: preferimos *.firebasestorage.app
const guessBucket = (raw) => {
  if (!raw) return null;
  let v = raw.trim();
  if (v.endsWith('.appspot.com')) {
    v = v.replace(/\.appspot\.com$/i, '.firebasestorage.app');
  }
  return v;
};

(async () => {
  try {
    console.log(`[dotenv] .env.local cargado`);
    console.log(`Usando credencial: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
    console.log(`ProjectId: ${projectId}`);

    const storage = new Storage({
      projectId,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });

    // Lista todos los buckets visibles en el proyecto
    const [buckets] = await storage.getBuckets({ project: projectId });
    console.log('Buckets en el proyecto:');
    buckets.forEach(b => console.log(' -', b.name));

    const target = guessBucket(rawBucket) || 'crm-sincro-v2.firebasestorage.app';
    console.log(`\nBucket objetivo: ${target}`);

    // Intenta obtener metadatos del bucket objetivo
    const [exists] = await storage.bucket(target).exists();
    if (!exists) {
      console.error(`❌ El bucket "${target}" no existe (o no es visible con esta credencial).`);
      process.exit(1);
    }

    const [meta] = await storage.bucket(target).getMetadata();
    console.log(`✅ OK: ${target}`);
    console.log('Ubicación:', meta.location, '| Clase de almacenamiento:', meta.storageClass);
  } catch (err) {
    console.error('Error verificando bucket:', err.message);
    process.exit(1);
  }
})();
