'use strict';
// Simula uma conversa completa sem chamar o Facebook: npm test
process.env.DRY_RUN = '1';
const { handle } = require('./bot');

const U = 'cliente-teste';
const say = async (label, input) => {
  console.log(`\nCLIENTE> ${label}`);
  await handle(U, input);
};

(async () => {
  await say('(toca em Começar)', { payload: 'GET_STARTED' });
  await say('Quanto custa o galão?', { text: 'Quanto custa o galão?' });
  await say('🛒 Fazer pedido', { payload: 'PEDIDO' });
  await say('Galão 20L (troca)', { payload: 'PROD:galao20', text: 'Galão 20L (troca)' });
  await say('Outra quantidade', { payload: 'QTD:OUTRA' });
  await say('3', { text: '3' });
  await say('➕ Adicionar outro', { payload: 'MAIS' });
  await say('Fardo 1,5L (6un)', { payload: 'PROD:fardo15' });
  await say('2', { payload: 'QTD:2' });
  await say('✅ Continuar', { payload: 'FECHAR' });
  await say('João Silva', { text: 'João Silva' });
  await say('Rua das Flores, 123, Centro, perto da padaria', { text: 'Rua das Flores, 123, Centro, perto da padaria' });
  await say('Pix', { payload: 'PAG:pix', text: 'Pix' });
  await say('✅ Confirmar', { payload: 'CONFIRMA' });
  await say('Preciso falar com uma pessoa', { text: 'Preciso falar com uma pessoa' });
  await say('(cliente escreve de novo; bot deve ficar calado)', { text: 'alô?' });
  await say('📋 Menu', { payload: 'MENU' });
  await say('asdfgh', { text: 'asdfgh' });
})();
