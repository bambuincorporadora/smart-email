const OpenAI = require('openai');
const defaultConfig = require('./defaultConfig');

const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const client = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

const defaultResponse = {
  priority: 'medium',
  summary: 'Resumo nao disponivel (configure OPENAI_API_KEY para ativar a IA).',
  actionNeeded: false,
  suggestedAction: 'Nenhuma acao sugerida.',
  implicitDeadline: null
};

function buildSystemPrompt(prompts = {}) {
  const high = prompts.high || defaultConfig.priorityPrompts.high;
  const medium = prompts.medium || defaultConfig.priorityPrompts.medium;
  const low = prompts.low || defaultConfig.priorityPrompts.low;

  return `
Voce e um assistente que classifica e-mails corporativos. Retorne JSON com:
priority: high|medium|low
summary: 2-3 frases em portugues
actionNeeded: true|false
suggestedAction: frase curta (responder, aprovar, agendar, delegar)
implicitDeadline: texto curto (hoje, amanha, data) ou null
Use as definicoes fornecidas:
- Alta: ${high}
- Media: ${medium}
- Baixa: ${low}
`.trim();
}

function buildUserPrompt(message) {
  return `
Remetente: ${message.from?.emailAddress?.address || 'desconhecido'}
Assunto: ${message.subject || '(sem assunto)'}
Corpo (preview): ${message.bodyPreview || ''}
Recebido em: ${message.receivedDateTime}
  `.trim();
}

async function classifyEmail(message, config = {}) {
  if (!client) {
    return defaultResponse;
  }

  try {
    const completion = await client.chat.completions.create({
      model: openaiModel,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildSystemPrompt(config.priorityPrompts) },
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
