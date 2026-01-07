import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      return new Response(JSON.stringify({ error: "Missing secrets (SUPABASE_URL / SERVICE_ROLE_KEY)" }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    // AuthN: require a valid Bearer token from a logged-in user
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.toLowerCase().startsWith('bearer ')){
      return new Response(JSON.stringify({ error: 'Missing Authorization Bearer token' }), { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } })
    }
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } }
    })
    const { data: userRes, error: userErr } = await authClient.auth.getUser()
    if (userErr || !userRes?.user){
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } })
    }
    const uid = userRes.user.id
    // AuthZ: require manager role
    const { data: roleRow, error: roleErr } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle()
    if (roleErr || !roleRow || roleRow.role !== 'manager'){
      return new Response(JSON.stringify({ error: 'Forbidden (manager only)' }), { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } })
    }

    let payload: any = {};
    try { payload = await req.json() } catch {
      return new Response(JSON.stringify({ error: "Body non valido (JSON)" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const { email, password, full_name, role } = payload;
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "email e password sono obbligatori" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Crea utente in Auth
    const { data: authRes, error: authErr } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (authErr) {
      return new Response(JSON.stringify({ error: authErr.message }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    const uidNew = authRes.user?.id;

    // Ruoli ammessi: 'manager' | 'user' | 'archived'
    const allowed = new Set(['manager','user','archived'])
    const r = allowed.has(String(role)) ? String(role) : 'user'

    const { error: profErr } = await supabase.from('profiles').upsert({
      id: uidNew, email, full_name: full_name || null, role: r
    });
    if (profErr) {
      return new Response(JSON.stringify({ error: profErr.message }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({ ok: true, user_id: uidNew }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (e) {
    console.error('create-user internal error', e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
});
