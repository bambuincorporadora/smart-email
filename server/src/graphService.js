const { Client } = require('@microsoft/microsoft-graph-client');

function createClient(accessToken) {
  return Client.init({
    authProvider: (done) => done(null, accessToken)
  });
}

function buildFilter({ unreadOnly, sinceDate }) {
  const filters = [];
  if (unreadOnly) {
    filters.push('isRead eq false');
  }
  if (sinceDate) {
    filters.push(`receivedDateTime ge ${sinceDate.toISOString()}`);
  }
  return filters.join(' and ');
}

async function fetchMessages(accessToken, { days = 2, unreadOnly = true, top = 30 } = {}) {
  const client = createClient(accessToken);
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);

  const filter = buildFilter({ unreadOnly, sinceDate });

  const response = await client
    .api('/me/mailFolders/Inbox/messages')
    .select([
      'id',
      'subject',
      'from',
      'toRecipients',
      'ccRecipients',
      'bodyPreview',
      'body',
      'receivedDateTime',
      'importance',
      'flag',
      'categories',
      'isRead',
      'webLink'
    ])
    .orderby('receivedDateTime DESC')
    .top(top)
    .filter(filter || undefined)
    .get();

  return response.value || [];
}

module.exports = {
  fetchMessages
};
