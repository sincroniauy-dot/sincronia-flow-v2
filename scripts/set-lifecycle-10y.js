// scripts/set-lifecycle-10y.js (CommonJS, autodetecta bucket)
require('dotenv/config');
const { Storage } = require('@google-cloud/storage');

async function pickBucket(storage) {
  const envName = process.env.FIREBASE_STORAGE_BUCKET;
  if (envName) {
    console.log('[info] Intentando bucket de env:', envName);
    const b = storage.bucket(envName);
    try {
      const [exists] = await b.exists();
      if (exists) return envName;
    } catch (_) {}
  }

  console.log('[info] Listando buckets del proyecto…');
  const [buckets] = await storage.getBuckets();
  if (!buckets.length) throw new Error('No se encontraron buckets en el proyecto');

  // Heurística: elegimos el que contenga "crm-sincro-v2"
  const wanted = buckets.find(x => x.name.includes('crm-sincro-v2'));
  if (wanted) return wanted.name;

  // Si no, probamos algún *.appspot.com
  const appspot = buckets.find(x => x.name.endsWith('.appspot.com'));
  if (appspot) return appspot.name;

  // Sino, el primero
  return buckets[0].name;
}

async function main() {
  const storage = new Storage(); // usa GOOGLE_APPLICATION_CREDENTIALS
  const bucketName = await pickBucket(storage);
  console.log('[info] Bucket elegido:', bucketName);

  const bucket = storage.bucket(bucketName);
  const lifecycle = [{
    action: { type: 'Delete' },
    condition: { age: 3650, matchesPrefix: ['documents/'] } // ~10 años
  }];

  await bucket.setMetadata({ lifecycle: { rule: lifecycle } });
  const [meta] = await bucket.getMetadata();
  console.log('✅ Lifecycle aplicado:', JSON.stringify(meta.lifecycle, null, 2));
}

main().catch(e => {
  console.error('set-lifecycle-10y error:', e.message);
  process.exit(1);
});
