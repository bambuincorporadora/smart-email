module.exports = {
  lookbackDays: 2,
  batchSize: 30,
  userEmail: 'meu.email@empresa.com',
  vipSenders: [
    'chefe@empresa.com',
    'diretoria@empresa.com',
    'clienteimportante@cliente.com'
  ],
  urgentKeywords: [
    'urgente',
    'prazo',
    'hoje',
    'aprovacao',
    'contrato',
    'pagamento',
    'amanha',
    'deadline'
  ],
  priorityPrompts: {
    high:
      'Alta = chefe/diretoria/cliente VIP; termos urgentes (urgente, prazo, hoje, aprovacao, contrato, pagamento); cobranca direta para o usuario; deadlines imediatos.',
    medium: 'Media = demandas de equipe ou pedidos de informacao sem urgencia imediata.',
    low: 'Baixa = comunicados gerais, newsletter, notificacoes automatizadas.'
  }
};
