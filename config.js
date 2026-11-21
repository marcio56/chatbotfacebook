'use strict';

// =====================================================================
//  EDITE AQUI: dados da empresa. Confira preços, horários e telefones
//  antes de colocar o bot no ar. Os valores abaixo são EXEMPLOS.
// =====================================================================
module.exports = {
  empresa: 'Disk Água Dinho',

  telefone: '(00) 00000-0000',   // << troque
  whatsapp: '(00) 00000-0000',   // << troque (ou deixe '' para ocultar)

  horario: 'Segunda a sábado, das 8h às 18h. Domingos e feriados, das 8h às 12h.',
  areaEntrega: 'Atendemos o centro e bairros próximos. Informe seu endereço e confirmamos se entregamos aí.',
  taxaEntrega: 'Entrega grátis a partir de 2 galões. Abaixo disso, taxa de R$ 3,00.',
  tempoEntrega: 'Em média 30 a 60 minutos.',

  // Formas de pagamento (id é interno; titulo aparece no botão, máx. 20 caracteres)
  pagamentos: [
    { id: 'pix', titulo: 'Pix' },
    { id: 'dinheiro', titulo: 'Dinheiro' },
    { id: 'cartao', titulo: 'Cartão (maquininha)' },
  ],

  // Produtos. titulo: máx. 20 caracteres (limite do botão do Messenger).
  // preco: número em reais, ou null para mostrar "consulte".
  produtos: [
    { id: 'galao20',   titulo: 'Galão 20L (troca)',  nome: 'Galão de água 20L (com troca do vasilhame)', preco: 12.0 },
    { id: 'galao20n',  titulo: 'Galão 20L novo',     nome: 'Galão de água 20L (vasilhame novo)',         preco: 35.0 },
    { id: 'fardo15',   titulo: 'Fardo 1,5L (6un)',   nome: 'Fardo de água 1,5L (6 unidades)',            preco: 14.0 },
    { id: 'fardo500',  titulo: 'Fardo 500ml (12un)', nome: 'Fardo de água 500ml (12 unidades)',          preco: 13.0 },
  ],

  // Tempo (minutos) que o bot fica calado depois de chamar um atendente
  minutosModoHumano: 120,
};
