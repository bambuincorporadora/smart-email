const OpenAI = require('openai');

const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const client = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

const defaultResponse = {
  priority: 'medium',
  summary: 'Resumo não disponível (configure OPENAI_API_KEY para ativar a IA).',
  actionNeeded: false,
  suggestedAction: 'Nenhuma ação sugerida.',
  implicitDeadline: null
};

const systemPrompt = `
Você é um assistente que classifica e-mails corporativos. Retorne JSON com:
priority: high|medium|low
summary: 2-3 frases em português
actionNeeded: true|false
suggestedAction: frase curta (responder, aprovar, agendar, delegar)
implicitDeadline: texto curto (hoje, amanhã, data) ou null
Regras: alta prioridade para chefe/diretoria/cliente importante ou termos urgentes (urgente, prazo, hoje, aprovação, contrato, pagamento) ou pedidos diretos ao usuário.
`.trim();

function buildUserPrompt(message) {
  return `
Remetente: ${message.from?.emailAddress?.address || 'desconhecido'}
Assunto: ${message.subject || '(sem assunto)'}
Corpo (preview): ${message.bodyPreview || ''}
Recebido em: ${message.receivedDateTime}
  `.trim();
}

async function classifyEmail(message) {
  if (!client) {
    return defaultResponse;
  }

  try {
    const completion = await client.chat.completions.create({
      model: openaiModel,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: buildUserPrompt(message) }
      ]
    });

    const content = completion.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(content);

    return {
      priority: parsed.priority || defaultResponse.priority,
      summary: parsed.summary || defaultResponse.summary,
      actionNeeded: parsed.actionNeeded ?? defaultResponse.actionNeeded,
      suggestedAction: parsed.suggestedAction || defaultResponse.suggestedAction,
      implicitDeadline: parsed.implicitDeadline || defaultResponse.implicitDeadline
    };
  } catch (error) {
    console.error('AI classification failed', error);
    return {
      ...defaultResponse,
      summary: 'Falha ao gerar resumo via IA.'
    };
  }
}

module.exports = {
  classifyEmail
};
