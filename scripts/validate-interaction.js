// scripts/validate-interaction.js
// Uso:
//  node scripts/validate-interaction.js "ESTADO_ACTUAL" "RESULTADO" [CONCEPTO]
// Ejemplos:
//  node scripts/validate-interaction.js "PROMESA" "PROMESA_DE_PAGO" "ENTREGA_CONVENIO"
//  node scripts/validate-interaction.js "PROMESA" "CONFIRMA_HABER_PAGO"
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const resultsByState = JSON.parse(fs.readFileSync(path.join(root, 'config', 'seeds', 'resultsByState.json'), 'utf8'));
const fieldsMatrix = JSON.parse(fs.readFileSync(path.join(root, 'config', 'seeds', 'fieldsMatrix.json'), 'utf8'));

const state = (process.argv[2] || '').trim();
const result = (process.argv[3] || '').trim();
const concept = (process.argv[4] || '').trim(); // CONTADO | ENTREGA_CONVENIO | PAGOS_A_CUENTA

if (!state || !result) {
  console.error('Uso: node scripts/validate-interaction.js "ESTADO_ACTUAL" "RESULTADO" [CONCEPTO]');
  process.exit(1);
}
const allowed = resultsByState[state] || [];
if (!allowed.includes(result)) {
  console.error(`❌ Resultado "${result}" NO permitido en estado "${state}". Permitidos: ${allowed.join(', ') || '(ninguno)'}`);
  process.exit(2);
}

const spec = fieldsMatrix[result] || {};
let required = spec.required || [];
let optional = spec.optional || [];
if (spec.variants) {
  if (!concept) {
    console.error(`⚠️ "${result}" requiere indicar CONCEPTO. Válidos: ${Object.keys(spec.variants).join(' | ')}`);
    process.exit(3);
  }
  const v = spec.variants[concept];
  if (!v) {
    console.error(`❌ Concepto "${concept}" no válido para "${result}". Válidos: ${Object.keys(spec.variants).join(' | ')}`);
    process.exit(4);
  }
  required = v;
}

console.log(`✅ Resultado "${result}" válido para estado "${state}"`);
if (concept) console.log(`   Concepto: ${concept}`);
console.log(`   Campos requeridos: ${required.length ? required.join(', ') : '(ninguno)'}`);
console.log(`   Opcionales: ${optional.length ? optional.join(', ') : '(ninguno)'}`);
