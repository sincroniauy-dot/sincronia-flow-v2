// lib/gcs.ts
import { Storage } from '@google-cloud/storage';

function normalizeBucket(name?: string | null) {
  const raw = (name || '').trim();
  if (!raw) return 'crm-sincro-v2.firebasestorage.app';
  return raw.endsWith('.appspot.com')
    ? raw.replace(/\.appspot\.com$/i, '.firebasestorage.app')
    : raw;
}

export function getBucketName() {
  return normalizeBucket(process.env.FIREBASE_STORAGE_BUCKET);
}

export function getStorage() {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  return new Storage({ projectId, keyFilename });
}

export function getBucket() {
  const storage = getStorage();
  return storage.bucket(getBucketName());
}
