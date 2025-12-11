require('dotenv').config();
require('isomorphic-fetch');

const express = require('express');
const cors = require('cors');
const graphService = require('./src/graphService');
const aiService = require('./src/aiService');
const rankingService = require('./src/rankingService');
const defaultConfig = require('./src/defaultConfig');

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const state = {
  config: { ...defaultConfig }
};

app.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

app.get('/config', (_req, res) => {
  res.json(state.config);
});

app.post('/config', (req, res) => {
  const incoming = req.body || {};
  state.config = {
    ...state.config,
    ...incoming,
    vipSenders: incoming.vipSenders || state.config.vipSenders,
    urgentKeywords: incoming.urgentKeywords || state.config.urgentKeywords
  };
  res.json(state.config);
});

app.get('/api/emails', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Access token is required in Authorization header' });
    return;
  }

  const days = Number(req.query.days || state.config.lookbackDays);
  const unreadOnly = String(req.query.unread || 'true') === 'true';
  const priorityFilter = req.query.priority;

  try {
    const messages = await graphService.fetchMessages(token, {
      days,
      unreadOnly,
      top: state.config.batchSize
    });

    const decorated = await Promise.all(
      messages.map(async (message) => {
        const rulePriority = rankingService.scoreByRules(message, state.config);
        const aiResult = await aiService.classifyEmail(message, state.config);
        const finalPriority = rankingService.mergePriority(rulePriority, aiResult.priority);

        return {
          id: message.id,
          from: message.from?.emailAddress?.address || message.from?.emailAddress?.name || 'Desconhecido',
          senderName: message.from?.emailAddress?.name || message.from?.emailAddress?.address || 'Remetente',
          subject: message.subject || '(Sem assunto)',
          receivedDateTime: message.receivedDateTime,
          priority: finalPriority,
          summary: aiResult.summary,
          actionNeeded: aiResult.actionNeeded,
          suggestedAction: aiResult.suggestedAction,
          implicitDeadline: aiResult.implicitDeadline,
          categories: message.categories || [],
          isRead: message.isRead,
          webLink: message.webLink
        };
      })
    );

    const filtered = priorityFilter
      ? decorated.filter((m) => m.priority === priorityFilter)
      : decorated;

    res.json({ items: filtered, count: filtered.length });
  } catch (error) {
    console.error('Error fetching emails', error);
    res.status(500).json({ error: 'Failed to fetch emails', detail: error.message });
  }
});

app.listen(port, () => {
  console.log(`Smart Mail backend running on port ${port}`);
});
