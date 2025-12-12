require('dotenv').config();
require('isomorphic-fetch');

const express = require('express');
const cors = require('cors');
const graphService = require('./src/graphService');
const aiService = require('./src/aiService');
const rankingService = require('./src/rankingService');
const defaultConfig = require('./src/defaultConfig');
const configService = require('./src/configService');
const supabase = require('./src/supabaseClient');

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const state = {
  config: { ...defaultConfig }
};

function getBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

app.get('/config', async (req, res) => {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    const { prefs } = await configService.loadConfigForUser(token);
    res.json(prefs);
  } catch (error) {
    console.error('Error loading config', error);
    if (error.message.includes('Supabase nao configurado')) {
      res.status(503).json({ error: 'Supabase nao configurado para configs por usuario.' });
    } else if (error.message.includes('Token sem oid/email')) {
      res.status(400).json({ error: 'Token invalido: falta oid/email.' });
    } else {
      res.status(500).json({ error: 'Failed to load config', detail: error.message });
    }
  }
});

app.post('/config', async (req, res) => {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }
  const incoming = req.body || {};
  try {
    const { prefs } = await configService.saveConfigForUser(token, incoming);
    res.json(prefs);
  } catch (error) {
    console.error('Error saving config', error);
    if (error.message.includes('Supabase nao configurado')) {
      res.status(503).json({ error: 'Supabase nao configurado para configs por usuario.' });
    } else if (error.message.includes('Token sem oid/email')) {
      res.status(400).json({ error: 'Token invalido: falta oid/email.' });
    } else {
      res.status(500).json({ error: 'Failed to save config', detail: error.message });
    }
  }
});

app.get('/api/emails', async (req, res) => {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Access token is required in Authorization header' });
    return;
  }

  const days = Number(req.query.days || state.config.lookbackDays);
  const unreadOnly = String(req.query.unread || 'true') === 'true';
  const priorityFilter = req.query.priority;

  try {
    // load user prefs if supabase configured; fallback to state.config otherwise
    let userConfig = state.config;
    if (supabase.isConfigured()) {
      try {
        const { prefs } = await configService.loadConfigForUser(token);
        userConfig = { ...state.config, ...prefs };
      } catch (err) {
        console.warn('Using default config (Supabase error):', err.message);
      }
    }

    const messages = await graphService.fetchMessages(token, {
      days,
      unreadOnly,
      top: userConfig.batchSize
    });

    const decorated = await Promise.all(
      messages.map(async (message) => {
        const rulePriority = rankingService.scoreByRules(message, userConfig);
        const aiResult = await aiService.classifyEmail(message, userConfig);
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
