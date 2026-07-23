import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};

function response(status: number, body: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response(405, { error: 'Method not allowed' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    return response(401, { error: 'Authentication required' });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user?.email) {
    return response(401, { error: 'Your session has expired. Sign in again.' });
  }

  let password = '';
  try {
    password = String((await request.json())?.password ?? '');
  } catch {
    return response(400, { error: 'Password is required' });
  }
  if (!password) return response(400, { error: 'Password is required' });

  const verificationClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
  });
  const { error: verificationError } = await verificationClient.auth.signInWithPassword({
    email: userData.user.email,
    password,
  });
  if (verificationError) return response(403, { error: 'Password is incorrect' });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: cleanupError } = await adminClient.rpc('prepare_account_deletion', {
    target_user_id: userData.user.id,
  });
  if (cleanupError) {
    console.error(JSON.stringify({
      event: 'account-cleanup-failed',
      userId: userData.user.id,
      code: cleanupError.code,
    }));
    return response(500, { error: 'Account data could not be removed. Please contact the operator.' });
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userData.user.id);
  if (deleteError) {
    console.error(JSON.stringify({ event: 'account-delete-failed', userId: userData.user.id }));
    return response(500, { error: 'Account could not be deleted. Please contact the operator.' });
  }

  console.info(JSON.stringify({ event: 'account-deleted', userId: userData.user.id }));
  return response(200, { message: 'Account deleted' });
});
