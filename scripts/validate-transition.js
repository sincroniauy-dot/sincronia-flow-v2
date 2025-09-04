// scripts/validate-transition.js
// Uso: node scripts/validate-transition.js "ESTADO_ORIGEN" "ESTADO_DESTINO"
const fs = require('fs');
const path = require('path');

const smPath = path.join(process.cwd(), 'config', 'seeds', 'stateMachine.json');
if (!fs.existsSync(smPath)) {
  console.error('No existe config/seeds/stateMachine.json');
  process.exit(1);
}
const sm = JSON.parse(fs.readFileSync(smPath, 'utf8'));
const from = (process.argv[2] || '').trim();
const to = (process.argv[3] || '').trim();

if (!from || !to) {
  console.error('Uso: node scripts/validate-transition.js "ESTADO_ORIGEN" "ESTADO_DESTINO"');
  process.exit(1);
}
if (!sm.states.includes(from)) {
  console.error(`Estado origen inválido: "${from}"`);
  process.exit(1);
}
if (!sm.states.includes(to)) {
  console.error(`Estado destino inválido: "${to}"`);
  process.exit(1);
}

const allowed = sm.transitions[from] || [];
if (allowed.includes(to)) {
  console.log(`✅ Transición PERMITIDA: ${from} → ${to}`);
  process.exit(0);
} else {
  console.error(`❌ Transición BLOQUEADA: ${from} → ${to}`);
  console.error(`   Permitidas desde "${from}": ${allowed.length ? allowed.join(', ') : '(ninguna)'}`);
  process.exit(2);
}
