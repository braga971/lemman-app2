// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

export default async (req: Request) => {
  const body = await req.json().catch(()=> ({}))
  const { email, password, full_name, role } = body || {}
  if(!email || !password) return new Response(JSON.stringify({ error:'email/password required' }), { status: 400 })

  const url = Deno.env.get('SUPABASE_URL')!
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supa = createClient(url, key)

  // 1) Crea auth user
  const { data: authUser, error: e1 } = await supa.auth.admin.createUser({
    email, password, email_confirm: true
  })
  if(e1) return new Response(JSON.stringify({ error: e1.message }), { status: 400 })
  const uid = authUser.user.id

  // 2) Upsert profilo
  const { error: e2 } = await supa.from('profiles').upsert({ id: uid, full_name, role: role || 'user' })
  if(e2) return new Response(JSON.stringify({ error: e2.message }), { status: 400 })

  return new Response(JSON.stringify({ ok:true, user_id: uid }), { headers: { 'Content-Type': 'application/json' } })
}
