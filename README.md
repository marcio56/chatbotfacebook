# Chatbot Disk Água Dinho (Messenger / Facebook)

Bot para a página do Facebook da Disk Água Dinho. O cliente pode:

- ver produtos e preços, horário, área de entrega e formas de pagamento;
- **fazer o pedido completo** (produtos, quantidades, nome, endereço, pagamento, confirmação);
- **falar com um atendente** (o bot fica quieto por 2 horas para você responder à mão).

Os pedidos aparecem na **Caixa de Entrada da página** (Meta Business Suite), são gravados em `orders.jsonl` e, opcionalmente, enviados como aviso para você.

## 1. Antes de tudo: edite `config.js`

Troque telefone, WhatsApp, horário, taxa de entrega e **os preços (são exemplos!)**.

## 2. Teste no seu computador (sem Facebook)

```
npm test
```

Simula uma conversa inteira no terminal. Precisa do Node.js 18 ou mais novo.

## 3. Crie o app no Facebook

1. Acesse https://developers.facebook.com → **Meus apps → Criar app** → tipo **Empresa** (Business).
2. Adicione o produto **Messenger**.
3. Em **Messenger → Configurações da API**, vincule a página da Disk Água Dinho e **gere o token de acesso** (`PAGE_ACCESS_TOKEN`).
4. Em **Configurações do app → Básico**, copie a **Chave Secreta do App** (`APP_SECRET`).
5. Invente uma senha qualquer para `VERIFY_TOKEN` (ex.: `dinho-agua-2026`).

## 4. Coloque o bot no ar

O bot precisa de um servidor sempre ligado com endereço **https** (Render, Railway, Fly.io, VPS etc.).
Não use plataformas "serverless" (como a Vercel): a memória da conversa se perderia entre uma mensagem e outra.

Variáveis de ambiente:

| Variável | O que é |
|---|---|
| `PAGE_ACCESS_TOKEN` | token da página (passo 3) |
| `APP_SECRET` | chave secreta do app (passo 4) |
| `VERIFY_TOKEN` | a senha que você inventou |
| `ADMIN_PSID` | (opcional) seu ID no Messenger, para receber aviso de pedido |

Comando de início: `npm start`.

## 5. Conecte o webhook

Em **Messenger → Configurações da API → Webhooks**:

- URL de callback: `https://SEU-SERVIDOR/webhook`
- Token de verificação: o `VERIFY_TOKEN`
- Marque os campos: `messages` e `messaging_postbacks`
- Assine a página da Disk Água Dinho.

## 6. Botão "Começar" e menu fixo

Com `PAGE_ACCESS_TOKEN` definido, rode uma vez:

```
npm run setup
```

## 7. Publicar para o público

Enquanto o app está em modo **Desenvolvimento**, só quem tem função no app (você, sua equipe) consegue conversar com o bot. Para atender qualquer cliente, deixe o app em modo **Ativo/Publicado**. Para a permissão `pages_messaging` ser usada com o público geral, o Facebook pode pedir a **Análise do app** e a verificação da empresa. Esse processo é do Facebook, não do bot.

## Observações

- `ADMIN_PSID`: o Facebook só deixa o bot te mandar mensagem se você tiver falado com a página nas últimas 24 h. Sem isso, o pedido continua aparecendo na Caixa de Entrada, dentro da própria conversa com o cliente.
- Se você responder um cliente pela Caixa de Entrada, ele está em "modo atendente" e o bot não interfere. O cliente volta ao automático tocando em "Menu" (ou após 2 h).
- O estado das conversas fica na memória: se o servidor reiniciar no meio de um pedido, o cliente recomeça do menu.
- Alterar mensagens: texto dos fluxos em `bot.js`; dados da empresa em `config.js`.
