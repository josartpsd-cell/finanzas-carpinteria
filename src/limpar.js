import { db, get, run } from './db.js';

const confirmar = process.argv.includes('--confirmar');

const antes = {
  movimentos: get('SELECT COUNT(*) n FROM transactions').n,
  vendas: get('SELECT COUNT(*) n FROM sales').n,
  mensagens: get('SELECT COUNT(*) n FROM whatsapp_messages').n,
  anexos: get('SELECT COUNT(*) n FROM attachments').n,
};

if (!confirmar) {
  console.log('Isto vai apagar:');
  console.log(`  ${antes.movimentos} movimentos`);
  console.log(`  ${antes.vendas} vendas`);
  console.log(`  ${antes.mensagens} mensagens de WhatsApp`);
  console.log(`  ${antes.anexos} anexos vinculados`);
  console.log('');
  console.log('Mantém: contas, categorias, sócios, senha e configuração do WhatsApp.');
  console.log('Para executar: npm run limpar -- --confirmar');
  process.exit(0);
}

db.exec('BEGIN');
try {
  db.exec('DELETE FROM attachments');
  db.exec('DELETE FROM whatsapp_messages');
  db.exec('DELETE FROM transactions');
  db.exec('DELETE FROM sales');
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('attachments','whatsapp_messages','transactions','sales')");
  db.exec('COMMIT');
} catch (e) {
  db.exec('ROLLBACK');
  console.error('Falhou, nada foi apagado:', e.message);
  process.exit(1);
}

console.log('Base limpa. Contas, categorias e sócios mantidos.');
console.log(`Removidos: ${antes.movimentos} movimentos, ${antes.vendas} vendas, ${antes.mensagens} mensagens, ${antes.anexos} anexos.`);
