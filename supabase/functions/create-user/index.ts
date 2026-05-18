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

    // AuthZ: only manager can create users
    const { data: me } = await supaAuth.auth.getUser()
    if (!me?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } })
    }
    const { data: roleRow, error: roleErr } = await supaAdmin.from('profiles').select('role').eq('id', me.user.id).maybeSingle()
    if (roleErr || !roleRow || roleRow.role !== 'manager') {
      return new Response(JSON.stringify({ error: 'Forbidden (manager only)' }), { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } })
    }

    // Payload
    let payload: any = {}
    try { payload = await req.json() } catch { payload = {} }
    const { email, password, full_name, matricola, role } = payload || {}
    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'email/password required' }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } })
    }

    // 0) Pre-check: if email already exists, return 409 to avoid generic DB error
    try {
      const list = await supaAdmin.auth.admin.listUsers()
      const exists = list?.users?.some(u => (u.email || '').toLowerCase() === String(email).toLowerCase())
      if (exists) {
        return new Response(JSON.stringify({ error: 'User already registered' }), { status: 409, headers: { "Content-Type": "application/json", ...corsHeaders } })
      }
    } catch (_) { /* ignore pre-check errors; proceed to create */ }

    // 1) Create auth user
    const nextRole = role || 'user'
    const { data: authUser, error: e1 } = await supaAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: nextRole }
    })
    if (e1) {
      // Log server-side for easier debugging (avoid logging password)
      console.error('create-user: admin.createUser failed', { email, code: (e1 as any)?.code, message: e1.message })
      // Map common cases for better UX
      const msg = e1.message || 'createUser failed'
      const status = /already\s+registered|exists/i.test(msg) ? 409 : 400
      const body = { error: msg, code: (e1 as any)?.code || null }
      return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } })
    }
    const uid = authUser!.user!.id

    // 2) Upsert profile
    const matricolaNumber = matricola === null || matricola === undefined || String(matricola).trim() === ''
      ? null
      : Number(matricola)
    const { error: e2 } = await supaAdmin.from('profiles').upsert({
      id: uid,
      email,
      full_name,
      matricola: typeof matricolaNumber === 'number' && Number.isFinite(matricolaNumber) ? matricolaNumber : null,
      role: nextRole
    })
    if (e2) {
      console.error('create-user: profiles upsert failed', { email, uid, message: e2.message })
      return new Response(JSON.stringify({ error: e2.message }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } })
    }

    return new Response(JSON.stringify({ ok: true, user_id: uid }), { headers: { "Content-Type": "application/json", ...corsHeaders } })
  } catch (e) {
    console.error('create-user internal error', e)
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } })
  }
})
