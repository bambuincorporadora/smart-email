const supabase = require('./supabaseClient');
const defaultConfig = require('./defaultConfig');

function parseJwtWithoutVerify(token) {
  try {
    const payload = token.split('.')[1];
    const decoded = Buffer.from(payload, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch (_e) {
    return {};
  }
}

function getUserInfoFromToken(token) {
  const claims = parseJwtWithoutVerify(token);
  const oid = claims.oid || claims.sub || null;
  const email =
    claims.preferred_username ||
    claims.upn ||
    claims.email ||
    claims.unique_name ||
    null;
  const name = claims.name || null;
  return { oid, email, name };
}

async function ensureProfile(client, userInfo) {
  if (!userInfo.oid || !userInfo.email) {
    throw new Error('Token sem oid/email; nao foi possivel identificar o usuario.');
  }
  const { data: existing, error: selectError } = await client
    .from('profiles')
    .select('id')
    .eq('microsoft_oid', userInfo.oid)
    .single();

  if (selectError && selectError.code !== 'PGRST116') {
    throw selectError;
  }
  if (existing) return existing.id;

  const { data: inserted, error: insertError } = await client
    .from('profiles')
    .insert({
      microsoft_oid: userInfo.oid,
      email: userInfo.email,
      display_name: userInfo.name || userInfo.email
    })
    .select('id')
    .single();

  if (insertError) throw insertError;
  return inserted.id;
}

async function getPreferences(client, userId) {
  const { data, error } = await client
    .from('preferences')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  if (!data) {
    return { ...defaultConfig };
  }
  return {
    lookbackDays: data.lookback_days ?? defaultConfig.lookbackDays,
    batchSize: defaultConfig.batchSize,
    userEmail: data.email || defaultConfig.userEmail,
    vipSenders: data.vip_senders || defaultConfig.vipSenders,
    urgentKeywords: data.urgent_keywords || defaultConfig.urgentKeywords
  };
}

async function upsertPreferences(client, userId, prefs) {
  const payload = {
    user_id: userId,
    lookback_days: prefs.lookbackDays ?? defaultConfig.lookbackDays,
    vip_senders: prefs.vipSenders ?? defaultConfig.vipSenders,
    urgent_keywords: prefs.urgentKeywords ?? defaultConfig.urgentKeywords
  };
  const { error } = await client
    .from('preferences')
    .upsert(payload, { onConflict: 'user_id' });
  if (error) throw error;
  return payload;
}

async function loadConfigForUser(accessToken) {
  if (!supabase.isConfigured()) {
    throw new Error('Supabase nao configurado');
  }
  const client = supabase.getClient();
  const userInfo = getUserInfoFromToken(accessToken);
  const userId = await ensureProfile(client, userInfo);
  const prefs = await getPreferences(client, userId);
  return { prefs, userId };
}

async function saveConfigForUser(accessToken, incoming) {
  if (!supabase.isConfigured()) {
    throw new Error('Supabase nao configurado');
  }
  const client = supabase.getClient();
  const userInfo = getUserInfoFromToken(accessToken);
  const userId = await ensureProfile(client, userInfo);
  const prefs = {
    lookbackDays: incoming.lookbackDays ?? defaultConfig.lookbackDays,
    vipSenders: incoming.vipSenders ?? defaultConfig.vipSenders,
    urgentKeywords: incoming.urgentKeywords ?? defaultConfig.urgentKeywords
  };
  await upsertPreferences(client, userId, prefs);
  return { prefs, userId };
}

module.exports = {
  loadConfigForUser,
  saveConfigForUser
};
