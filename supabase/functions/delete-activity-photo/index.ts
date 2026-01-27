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
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY){
      return new Response(JSON.stringify({ error: 'Missing secrets' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
    }
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.toLowerCase().startsWith('bearer ')){
      return new Response(JSON.stringify({ error: 'Missing Authorization Bearer token' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
    }
    const supaAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false }, global: { headers: { Authorization: authHeader } } })
    const me = await supaAuth.auth.getUser()
    const meId = me?.data?.user?.id || null
    const meRole = (me?.data?.user?.user_metadata as any)?.role || (me?.data as any)?.user?.role || null
    if (!meId){
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
    }

    let payload: any = {}
    try { payload = await req.json() } catch { payload = {} }
    const { taskId } = payload || {}
    if (!taskId){
      return new Response(JSON.stringify({ error: 'taskId required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
    }

    const supaAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    // Load task with photo
    const { data: task, error: tErr } = await supaAdmin
      .from('tasks')
      .select('id,user_id,photo_url,photo_path')
      .eq('id', taskId)
      .single()
    if (tErr){
      return new Response(JSON.stringify({ error: tErr.message }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
    }
    if (!task){
      return new Response(JSON.stringify({ error: 'Task not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
    }
    const isManager = String(meRole).toLowerCase() === 'manager'
    if (!isManager && task.user_id !== meId){
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
    }

    // If photo exists, delete from storage
    if (task.photo_path){
      // tasks-temp bucket by convention
      const bucket = 'tasks-temp'
      try{ await supaAdmin.storage.from(bucket).remove([task.photo_path]) } catch(_){ /* ignore */ }
    }
    // Clear fields
    await supaAdmin.from('tasks').update({ photo_url: null, photo_path: null, photo_expires_at: null }).eq('id', task.id)

    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } })
  }catch(e){
    console.error('delete-activity-photo internal error', e)
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
  }
})
