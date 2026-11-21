'use strict';
/**
 * Chatbot de Messenger (Facebook) - Disk Água Dinho
 * Sem dependências: precisa apenas do Node.js 18+.
 */
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const cfg = require('./config');

const PAGE_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const APP_SECRET = process.env.APP_SECRET;
const ADMIN_PSID = process.env.ADMIN_PSID; // opcional: recebe aviso de pedido
const DRY_RUN = process.env.DRY_RUN === '1'; // teste local: não chama o Facebook
const PORT = process.env.PORT || 3000;
const ORDERS_FILE = path.join(__dirname, 'orders.jsonl');

// ---------------------------------------------------------------- utilidades
const norm = (s = '') =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const brl = (n) => 'R$ ' + n.toFixed(2).replace('.', ',');
const precoTxt = (p) => (p.preco == null ? 'consulte' : brl(p.preco));

// ---------------------------------------------------------------- Send API
async function callSend(body) {
  if (DRY_RUN) {
    if (body.message) {
      const qr = (body.message.quick_replies || []).map((q) => `[${q.title}]`).join(' ');
      console.log(`BOT> ${body.message.text}${qr ? '\n     ' + qr : ''}`);
    }
    return;
  }
  try {
    const res = await fetch('https://graph.facebook.com/v21.0/me/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PAGE_TOKEN}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.error('Erro na Send API:', res.status, await res.text());
  } catch (e) {
    console.error('Falha ao chamar a Send API:', e.message);
  }
}

const say = (psid, text, replies) =>
  callSend({
    recipient: { id: psid },
    messaging_type: 'RESPONSE',
    message: {
      text: text.slice(0, 2000),
      ...(replies && {
        quick_replies: replies.slice(0, 13).map(([title, payload]) => ({
          content_type: 'text',
          title: title.slice(0, 20),
          payload,
        })),
      }),
    },
  });

const typing = (psid) =>
  callSend({ recipient: { id: psid }, sender_action: 'typing_on' });

// ---------------------------------------------------------------- sessões
const sessions = new Map(); // psid -> estado (memória; reinicia se o servidor reiniciar)
const getSession = (psid) => {
  if (!sessions.has(psid)) sessions.set(psid, { step: 'menu', itens: [], humanoAte: 0 });
  return sessions.get(psid);
};
const reset = (s) => {
  s.step = 'menu';
  s.itens = [];
  s.atual = null;
  s.nome = s.endereco = s.pagamento = null;
};

// ---------------------------------------------------------------- telas
const MENU = [
  ['🛒 Fazer pedido', 'PEDIDO'],
  ['💧 Produtos/preços', 'PRECOS'],
  ['🕒 Horário/entrega', 'ENTREGA'],
  ['💳 Pagamento', 'PAGAMENTO'],
  ['👤 Atendente', 'HUMANO'],
];

const menu = (psid, saudacao = true) =>
  say(
    psid,
    (saudacao ? `Olá! 👋 Bem-vindo(a) à ${cfg.empresa}, a sua água gelada e de qualidade na porta de casa. 💧\n\n` : '') +
      'Como posso ajudar?',
    MENU
  );

const voltar = [['📋 Menu', 'MENU']];

const mostrarPrecos = (psid) =>
  say(
    psid,
    '💧 Nossos produtos:\n\n' +
      cfg.produtos.map((p) => `• ${p.nome}: ${precoTxt(p)}`).join('\n') +
      `\n\n${cfg.taxaEntrega}`,
    [['🛒 Fazer pedido', 'PEDIDO'], ...voltar]
  );

const mostrarEntrega = (psid) =>
  say(
    psid,
    `🕒 Horário de atendimento:\n${cfg.horario}\n\n` +
      `🚚 Entrega:\n${cfg.areaEntrega}\n${cfg.tempoEntrega}\n${cfg.taxaEntrega}\n\n` +
      `📞 Telefone: ${cfg.telefone}` +
      (cfg.whatsapp ? `\n💬 WhatsApp: ${cfg.whatsapp}` : ''),
    [['🛒 Fazer pedido', 'PEDIDO'], ...voltar]
  );

const mostrarPagamento = (psid) =>
  say(
    psid,
    '💳 Aceitamos: ' + cfg.pagamentos.map((p) => p.titulo).join(', ') + '.\nO pagamento é feito na entrega.',
    [['🛒 Fazer pedido', 'PEDIDO'], ...voltar]
  );

const chamarHumano = (psid, s) => {
  s.humanoAte = Date.now() + cfg.minutosModoHumano * 60000;
  reset(s);
  console.log(`CLIENTE PEDIU ATENDENTE: ${psid}`);
  if (ADMIN_PSID && ADMIN_PSID !== psid) {
    say(ADMIN_PSID, `🔔 Um cliente pediu atendimento humano. Abra a Caixa de Entrada da página para responder.`);
  }
  return say(
    psid,
    `👤 Certo! Já avisei nossa equipe e em breve alguém responde por aqui.\n` +
      `Se preferir, ligue para ${cfg.telefone}.\n\n` +
      'Para voltar ao menu automático, toque no botão abaixo.',
    voltar
  );
};

// ---------------------------------------------------------------- pedido
const perguntarProduto = (psid, s) => {
  s.step = 'produto';
  return say(
    psid,
    'Qual produto você deseja?',
    [...cfg.produtos.map((p) => [p.titulo, 'PROD:' + p.id]), ['❌ Cancelar', 'MENU']]
  );
};

const perguntarQtd = (psid, s) => {
  s.step = 'qtd';
  return say(psid, `Quantas unidades de "${s.atual.nome}"?`, [
    ['1', 'QTD:1'], ['2', 'QTD:2'], ['3', 'QTD:3'], ['4', 'QTD:4'], ['5', 'QTD:5'],
    ['Outra quantidade', 'QTD:OUTRA'], ['❌ Cancelar', 'MENU'],
  ]);
};

const adicionarItem = (psid, s, qtd) => {
  s.itens.push({ produto: s.atual, qtd });
  s.atual = null;
  s.step = 'mais';
  return say(psid, `✅ Adicionado: ${qtd}x ${s.itens[s.itens.length - 1].produto.nome}.\n\nDeseja mais alguma coisa?`, [
    ['➕ Adicionar outro', 'MAIS'],
    ['✅ Continuar', 'FECHAR'],
    ['❌ Cancelar', 'MENU'],
  ]);
};

const totais = (s) => {
  let total = 0, aConfirmar = false;
  for (const { produto, qtd } of s.itens) {
    if (produto.preco == null) aConfirmar = true;
    else total += produto.preco * qtd;
  }
  return { total, aConfirmar };
};

const resumo = (s) => {
  const linhas = s.itens.map(
    ({ produto, qtd }) =>
      `• ${qtd}x ${produto.nome}` + (produto.preco == null ? '' : ` = ${brl(produto.preco * qtd)}`)
  );
  const { total, aConfirmar } = totais(s);
  return (
    linhas.join('\n') +
    `\n\nSubtotal: ${aConfirmar ? 'a confirmar' : brl(total)}` +
    `\n(${cfg.taxaEntrega})` +
    `\n\n👤 ${s.nome}\n📍 ${s.endereco}\n💳 ${s.pagamento}`
  );
};

async function finalizarPedido(psid, s) {
  const texto = resumo(s);
  const pedido = {
    data: new Date().toISOString(),
    psid,
    nome: s.nome,
    endereco: s.endereco,
    pagamento: s.pagamento,
    itens: s.itens.map(({ produto, qtd }) => ({ id: produto.id, nome: produto.nome, qtd, preco: produto.preco })),
  };
  try { fs.appendFileSync(ORDERS_FILE, JSON.stringify(pedido) + '\n'); } catch (e) { console.error('Não consegui salvar o pedido:', e.message); }
  console.log('NOVO PEDIDO:\n' + texto);

  if (ADMIN_PSID && ADMIN_PSID !== psid) {
    await say(ADMIN_PSID, `🔔 NOVO PEDIDO (${cfg.empresa})\n\n${texto}`);
  }
  reset(s);
  return say(
    psid,
    `🎉 Pedido recebido! Obrigado, ${pedido.nome.split(' ')[0]}.\n\n${texto}\n\n` +
      `${cfg.tempoEntrega} Qualquer dúvida: ${cfg.telefone}.`,
    [['🛒 Novo pedido', 'PEDIDO'], ...voltar]
  );
}

// ---------------------------------------------------------------- roteador
async function handle(psid, { text, payload }) {
  const s = getSession(psid);
  const t = norm(text || '');

  // Modo atendente humano: o bot fica quieto, a não ser que o cliente volte ao menu
  if (s.humanoAte > Date.now()) {
    if (payload === 'MENU' || t === 'menu') s.humanoAte = 0;
    else return;
  }

  await typing(psid);

  // Comandos globais
  if (payload === 'GET_STARTED') { reset(s); return menu(psid); }
  if (payload === 'MENU' || /^(menu|inicio|voltar|cancelar|cancela)$/.test(t)) { reset(s); return menu(psid, false); }
  if (payload === 'HUMANO') return chamarHumano(psid, s);
  if (payload === 'PRECOS') return mostrarPrecos(psid);
  if (payload === 'ENTREGA') return mostrarEntrega(psid);
  if (payload === 'PAGAMENTO') return mostrarPagamento(psid);
  if (payload === 'PEDIDO') { reset(s); return perguntarProduto(psid, s); }

  // Passos do pedido
  switch (s.step) {
    case 'produto': {
      let prod = null;
      if (payload?.startsWith('PROD:')) prod = cfg.produtos.find((p) => p.id === payload.slice(5));
      else if (t) prod = cfg.produtos.find((p) => norm(p.titulo) === t || norm(p.nome).includes(t));
      if (!prod) return say(psid, 'Não encontrei esse produto. Escolha uma das opções:', [
        ...cfg.produtos.map((p) => [p.titulo, 'PROD:' + p.id]), ['❌ Cancelar', 'MENU'],
      ]);
      s.atual = prod;
      return perguntarQtd(psid, s);
    }
    case 'qtd': {
      if (payload === 'QTD:OUTRA') {
        s.step = 'qtd_livre';
        return say(psid, 'Digite a quantidade (número):');
      }
      const n = payload?.startsWith('QTD:') ? parseInt(payload.slice(4), 10) : parseInt(t, 10);
      if (!(n >= 1 && n <= 99)) return say(psid, 'Escolha uma quantidade nos botões ou digite um número de 1 a 99.');
      return adicionarItem(psid, s, n);
    }
    case 'qtd_livre': {
      const n = parseInt(t, 10);
      if (!(n >= 1 && n <= 99)) return say(psid, 'Digite um número de 1 a 99, por favor.');
      return adicionarItem(psid, s, n);
    }
    case 'mais':
      if (payload === 'MAIS' || /^(mais|outro|adicionar)/.test(t)) return perguntarProduto(psid, s);
      if (payload === 'FECHAR' || /^(continuar|fechar|so isso|nao|ok|pronto)/.test(t)) {
        s.step = 'nome';
        return say(psid, 'Perfeito! Qual o seu nome?');
      }
      return say(psid, 'Deseja adicionar mais algum produto?', [['➕ Adicionar outro', 'MAIS'], ['✅ Continuar', 'FECHAR']]);
    case 'nome':
      if (t.length < 2) return say(psid, 'Por favor, digite seu nome.');
      s.nome = text.trim().slice(0, 80);
      s.step = 'endereco';
      return say(psid, '📍 Qual o endereço de entrega? (rua, número, bairro e ponto de referência)');
    case 'endereco':
      if (t.length < 8) return say(psid, 'Preciso do endereço completo: rua, número e bairro, por favor.');
      s.endereco = text.trim().slice(0, 300);
      s.step = 'pagamento';
      return say(psid, '💳 Como prefere pagar na entrega?', cfg.pagamentos.map((p) => [p.titulo, 'PAG:' + p.id]));
    case 'pagamento': {
      let pg = null;
      if (payload?.startsWith('PAG:')) pg = cfg.pagamentos.find((p) => p.id === payload.slice(4));
      else pg = cfg.pagamentos.find((p) => t.includes(norm(p.id)) || norm(p.titulo).includes(t));
      if (!pg || !t && !payload) return say(psid, 'Escolha uma forma de pagamento:', cfg.pagamentos.map((p) => [p.titulo, 'PAG:' + p.id]));
      s.pagamento = pg.titulo;
      s.step = 'confirmar';
      return say(psid, `Confira seu pedido:\n\n${resumo(s)}\n\nPosso confirmar?`, [
        ['✅ Confirmar', 'CONFIRMA'], ['❌ Cancelar', 'MENU'],
      ]);
    }
    case 'confirmar':
      if (payload === 'CONFIRMA' || /^(sim|confirmo|confirmar|pode|ok)/.test(t)) return finalizarPedido(psid, s);
      return say(psid, 'Toque em Confirmar para enviar o pedido ou Cancelar para desistir.', [
        ['✅ Confirmar', 'CONFIRMA'], ['❌ Cancelar', 'MENU'],
      ]);
  }

  // Texto livre fora do pedido: detecção simples de intenção
  if (/(horario|abre|fecha|funciona|taxa|entrega|entregam|bairro|area|atende|demora)/.test(t)) return mostrarEntrega(psid);
  if (/(preco|valor|quanto|produto|cardapio|tabela|custa)/.test(t)) return mostrarPrecos(psid);
  if (/(pagamento|pix|cartao|dinheiro|pagar|troco)/.test(t)) return mostrarPagamento(psid);
  if (/(atendente|humano|pessoa|falar com|ligar|telefone|whats|reclama)/.test(t)) return chamarHumano(psid, s);
  if (/(pedido|pedir|quero|comprar|galao|fardo|agua)/.test(t)) { reset(s); return perguntarProduto(psid, s); }
  if (/^(oi|ola|bom dia|boa tarde|boa noite|eai|opa|e ai)/.test(t)) return menu(psid);

  return say(psid, 'Desculpe, não entendi. 😅 Escolha uma opção abaixo ou fale com um atendente:', MENU);
}

async function handleEvent(ev) {
  const psid = ev.sender?.id;
  if (!psid) return;
  if (ev.postback) return handle(psid, { payload: ev.postback.payload, text: ev.postback.title });
  if (ev.message && !ev.message.is_echo) {
    const payload = ev.message.quick_reply?.payload;
    if (ev.message.text || payload) return handle(psid, { text: ev.message.text, payload });
    // Foto, áudio, localização etc.
    return say(psid, 'Recebi seu envio! Para eu entender melhor, use os botões ou escreva sua mensagem. 😊', MENU);
  }
}

// ---------------------------------------------------------------- servidor
function assinaturaValida(raw, header) {
  if (!APP_SECRET) return true; // sem segredo configurado: não valida (ok só em teste)
  if (!header) return false;
  const esperado = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(raw).digest('hex');
  const a = Buffer.from(esperado), b = Buffer.from(header);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function startServer() {
  if (!DRY_RUN && (!PAGE_TOKEN || !VERIFY_TOKEN)) {
    console.error('Defina PAGE_ACCESS_TOKEN e VERIFY_TOKEN (veja o README).');
    process.exit(1);
  }
  if (!APP_SECRET) console.warn('Aviso: APP_SECRET não definido, assinatura das requisições NÃO está sendo verificada.');

  http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname !== '/webhook') { res.writeHead(200); return res.end('Disk Água Dinho bot no ar 💧'); }

    // Verificação do webhook pelo Facebook
    if (req.method === 'GET') {
      if (url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === VERIFY_TOKEN) {
        res.writeHead(200); return res.end(url.searchParams.get('hub.challenge'));
      }
      res.writeHead(403); return res.end();
    }

    if (req.method === 'POST') {
      const chunks = [];
      let size = 0;
      req.on('data', (c) => { size += c.length; if (size > 1e6) req.destroy(); else chunks.push(c); });
      req.on('end', () => {
        const raw = Buffer.concat(chunks);
        if (!assinaturaValida(raw, req.headers['x-hub-signature-256'])) { res.writeHead(403); return res.end(); }
        res.writeHead(200); res.end('EVENT_RECEIVED'); // responde rápido; processa depois
        try {
          const body = JSON.parse(raw.toString('utf8'));
          if (body.object !== 'page') return;
          for (const entry of body.entry || [])
            for (const ev of entry.messaging || [])
              handleEvent(ev).catch((e) => console.error('Erro ao tratar evento:', e));
        } catch (e) { console.error('Corpo inválido:', e.message); }
      });
      return;
    }
    res.writeHead(405); res.end();
  }).listen(PORT, () => console.log(`Bot escutando na porta ${PORT}`));
}

if (require.main === module) startServer();
module.exports = { handleEvent, handle };
