const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

let client = null;
if (supabaseUrl && supabaseServiceRole) {
  client = createClient(supabaseUrl, supabaseServiceRole);
}

function getClient() {
  if (!client) {
    throw new Error('Supabase nao configurado (faltando SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY)');
  }
  return client;
}

module.exports = {
  getClient
};
