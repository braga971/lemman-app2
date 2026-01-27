import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try{
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY){
      return new Response(JSON.stringify({ error: 'Missing secrets' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
    }
    // Optional: allow anonymous trigger (cron) or require manager
    const authHeader = req.headers.get('Authorization') || ''
    const supaAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

    const nowIso = new Date().toISOString()
    // Fetch in small batches to be safe
    const { data: rows, error } = await supaAdmin
      .from('tasks')
      .select('id, photo_path')
      .not('photo_path', 'is', null)
      .lte('photo_expires_at', nowIso)
      .limit(500)
    if (error){
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
    }

    const paths: string[] = []
    for (const r of (rows||[])) if (r.photo_path) paths.push(r.photo_path)
    if (paths.length){
      try{ await supaAdmin.storage.from('tasks-temp').remove(paths) } catch(_){ /* ignore */ }
      await supaAdmin.from('tasks').update({ photo_url: null, photo_path: null, photo_expires_at: null }).in('id', (rows||[]).map(r=>r.id))
    }

    return new Response(JSON.stringify({ ok: true, deleted: paths.length }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } })
  }catch(e){
    console.error('clear-expired-task-photos internal error', e)
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
  }
})

