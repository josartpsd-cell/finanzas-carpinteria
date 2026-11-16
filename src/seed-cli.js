import { seed } from './seed.js';

const force = process.argv.includes('--force');
const ok = seed({ force });
console.log(ok ? 'Dados de exemplo gerados.' : 'Banco já tem lançamentos. Use --force para recriar.');
