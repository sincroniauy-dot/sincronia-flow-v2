// write-env.js
const fs = require('fs');
const path = require('path');

// ⚠️ Cambia este nombre si tu archivo JSON es distinto
const saFile = path.join(__dirname, 'crm-sincro-v2-firebase-adminsdk-fbsvc-be77fccdcb.json');

// 1) Lee el JSON y lo pasa a una sola línea
const oneLine = fs.readFileSync(saFile, 'utf8').replace(/\r?\n/g, ' ');

// 2) Arma el contenido del .env
const env = [
  '# --- Servidor ---',
  'JWT_SECRET=sincronia_secret_key_123',
  'PUBLIC_BASE_URL=http://localhost:3001',
  '',
  '# --- Firebase Admin ---',
  `FIREBASE_SERVICE_ACCOUNT=${oneLine}`,
  '',
  '# --- Firma por defecto para Cartas de Cancelación (Mercurius) ---',
  'COMPANY_LOCATION=Montevideo',
  'COMPANY_SIGNATORY_NAME=Dr. Francisco Algorta',
  'COMPANY_SIGNATORY_TITLE=ABOGADO',
  'COMPANY_SIGNATORY_MAT=Mat. 15.597',
  ''
].join('\n');

// 3) Escribe el archivo .env
fs.writeFileSync(path.join(__dirname, '.env'), env, 'utf8');
console.log('✅ .env escrito correctamente');
