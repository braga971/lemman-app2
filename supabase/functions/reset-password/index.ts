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
      return new Response(JSON.stringify({ error: "Missing secrets (SUPABASE_URL / SERVICE_ROLE_KEY / SUPABASE_ANON_KEY)" }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    const supaAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    // AuthN: require Authorization Bearer from client
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.toLowerCase().startsWith('bearer ')){
      return new Response(JSON.stringify({ error: 'Missing Authorization Bearer token' }), { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } })
    }
    const supaAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false }, global: { headers: { Authorization: authHeader } } })
    const { data: me, error: meErr } = await supaAuth.auth.getUser()
    if (meErr || !me?.user){
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } })
    }

    // AuthZ: only manager can reset passwords
    const { data: roleRow, error: roleErr } = await supaAdmin.from('profiles').select('role').eq('id', me.user.id).maybeSingle()
    if (roleErr || !roleRow || roleRow.role !== 'manager'){
      return new Response(JSON.stringify({ error: 'Forbidden (manager only)' }), { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } })
    }

    let payload: any = {}
    try { payload = await req.json() } catch { payload = {} }
    const { user_id, password } = payload || {}
    if (!user_id || !password){
      return new Response(JSON.stringify({ error: 'user_id and password are required' }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } })
    }

    const { error: updErr } = await supaAdmin.auth.admin.updateUserById(user_id, { password })
    if (updErr){
      return new Response(JSON.stringify({ error: updErr.message }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } })
    }

    return new Response(JSON.stringify({ ok:true }), { headers: { "Content-Type": "application/json", ...corsHeaders } })
  } catch (e) {
    console.error('reset-password internal error', e)
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } })
  }
})

