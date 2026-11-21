'use strict';
// Rode UMA vez (node setup.js): configura o botão "Começar", a mensagem de
// boas-vindas e o menu fixo da conversa na página do Facebook.
const cfg = require('./config');
const TOKEN = process.env.PAGE_ACCESS_TOKEN;
if (!TOKEN) { console.error('Defina PAGE_ACCESS_TOKEN.'); process.exit(1); }

(async () => {
  const body = {
    get_started: { payload: 'GET_STARTED' },
    greeting: [{
      locale: 'default',
      text: `Olá, {{user_first_name}}! 💧 Aqui é a ${cfg.empresa}. Toque em Começar para pedir sua água.`,
    }],
    persistent_menu: [{
      locale: 'default',
      composer_input_disabled: false,
      call_to_actions: [
        { type: 'postback', title: '🛒 Fazer pedido', payload: 'PEDIDO' },
        { type: 'postback', title: '💧 Produtos e preços', payload: 'PRECOS' },
        { type: 'postback', title: '👤 Falar com atendente', payload: 'HUMANO' },
      ],
    }],
  };
  const res = await fetch('https://graph.facebook.com/v21.0/me/messenger_profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(body),
  });
  console.log(res.status, await res.text());
})();
