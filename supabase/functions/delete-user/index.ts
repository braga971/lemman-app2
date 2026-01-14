import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      return new Response(JSON.stringify({ error: "Missing secrets (SUPABASE_URL / SERVICE_ROLE_KEY / SUPABASE_ANON_KEY)" }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
      })
    }

    // AuthN: require Authorization Bearer from client
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing Authorization Bearer token' }), { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } })
    }

    const supaAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    const supaAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false }, global: { headers: { Authorization: authHeader } } })

    // AuthZ: only manager can delete users
    const { data: me } = await supaAuth.auth.getUser()
    if (!me?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } })
    }
    const { data: roleRow, error: roleErr } = await supaAdmin.from('profiles').select('role').eq('id', me.user.id).maybeSingle()
    if (roleErr || !roleRow || roleRow.role !== 'manager') {
      return new Response(JSON.stringify({ error: 'Forbidden (manager only)' }), { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } })
    }

    let payload: any = {}
    try { payload = await req.json() } catch { payload = {} }
    const { user_id, email } = payload || {}
    let uid = user_id as string | undefined

    if (!uid && email) {
      const { data: users, error: eu } = await supaAdmin.auth.admin.listUsers()
      if (eu) {
        return new Response(JSON.stringify({ error: eu.message }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } })
      }
      uid = users.users.find(u => u.email?.toLowerCase() === String(email).toLowerCase())?.id
      if (!uid) {
        return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } })
      }
    }

    if (!uid) {
      return new Response(JSON.stringify({ error:'user_id or email required' }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } })
    }

    // Do not delete profile here; client may archive it
    const { error } = await supaAdmin.auth.admin.deleteUser(uid)
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } })
    }

    return new Response(JSON.stringify({ ok:true, user_id: uid }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } })
  } catch (e) {
    console.error('delete-user internal error', e)
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } })
  }
})

