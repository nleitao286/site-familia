import { createClient } from 'npm:@supabase/supabase-js@2.58.0';
import { createHandler, readAccessConfig } from './handler.js';

let config = null;
try {
  config = readAccessConfig(Deno.env.get('FAMILIA_ADMIN_USER_ID'), Deno.env.get('FAMILIA_ACESSOS'));
} catch { /* Falha fechada se a configuração privada estiver incompleta. */ }
const url = Deno.env.get('SUPABASE_URL');
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const client = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
Deno.serve(createHandler({ client, config }));
