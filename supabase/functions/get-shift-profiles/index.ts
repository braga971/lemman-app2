import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: 'Missing secrets SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

    let body: any = {}
    try { body = await req.json() } catch { body = {} }
    const site = String(body?.site || '')
    const week_start = String(body?.week_start || '')
    if (!site || !week_start) {
      return new Response(JSON.stringify({ error: 'site and week_start are required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
    }

    // Load schedule and collect user ids
    const { data: row, error: schErr } = await supabase
      .from('shift_schedules')
      .select('payload')
      .eq('site', site)
      .eq('week_start', week_start)
      .maybeSingle()
    if (schErr) {
      return new Response(JSON.stringify({ error: schErr.message }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
    }
    const payload = (row?.payload || {}) as Record<string, { users?: Array<string | { id: string }> }>
    const ids = new Set<string>()
    for (const key of Object.keys(payload)) {
      const users = payload[key]?.users || []
      for (const u of users) {
        if (typeof u === 'string') ids.add(u)
        else if (u && typeof (u as any).id === 'string') ids.add((u as any).id)
      }
    }
    const list = Array.from(ids)
    if (!list.length) return new Response(JSON.stringify({ profiles: [] }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } })

    const { data: profs, error: profErr } = await supabase
      .from('profiles')
      .select('id,full_name,email')
      .in('id', list)
    if (profErr) {
      return new Response(JSON.stringify({ error: profErr.message }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
    }
    return new Response(JSON.stringify({ profiles: profs || [] }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
  }
})

