const PRIORITY = ['low', 'medium', 'high'];

function normalizePriority(value) {
  const clean = (value || '').toString().toLowerCase();
  if (clean === 'alta' || clean === 'high') return 'high';
  if (clean === 'media' || clean === 'média' || clean === 'medium') return 'medium';
  return 'low';
}

function scoreByRules(message, config) {
  const sender = message.from?.emailAddress?.address || '';
  const subject = (message.subject || '').toLowerCase();
  const bodyPreview = (message.bodyPreview || '').toLowerCase();

  const isVip = config.vipSenders.some((vip) => sender.toLowerCase().includes(vip.toLowerCase()));
  if (isVip) return 'high';

  const keywordHit = config.urgentKeywords.some(
    (kw) => subject.includes(kw.toLowerCase()) || bodyPreview.includes(kw.toLowerCase())
  );
  if (keywordHit) return 'high';

  const mentionsUser =
    (message.toRecipients || []).some((r) => r.emailAddress?.address === config.userEmail) ||
    (message.ccRecipients || []).some((r) => r.emailAddress?.address === config.userEmail);

  if (mentionsUser) return 'medium';

  return 'low';
}

function mergePriority(rulePriority, aiPriority) {
  const rule = normalizePriority(rulePriority);
  const ai = normalizePriority(aiPriority);
  const maxIndex = Math.max(PRIORITY.indexOf(rule), PRIORITY.indexOf(ai));
  return PRIORITY[maxIndex] || 'low';
}

module.exports = {
  scoreByRules,
  mergePriority
};
