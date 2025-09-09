// deno-lint-ignore-file no-explicit-any
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

export default async (req: Request) => {
  const body = await req.json().catch(()=> ({}))
  const { user_id, email } = body || {}
  const url = Deno.env.get('SUPABASE_URL')!
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supa = createClient(url, key)

  // Se non c'è user_id, prova a risolverlo da email
  let uid = user_id
  if(!uid && email){
    const { data: users, error: eu } = await supa.auth.admin.listUsers()
    if(eu) return new Response(JSON.stringify({ error: eu.message }), { status: 400 })
    uid = users.users.find(u => u.email?.toLowerCase() === String(email).toLowerCase())?.id
    if(!uid) return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 })
  }
  if(!uid) return new Response(JSON.stringify({ error:'user_id or email required' }), { status: 400 })

  // 1) Cancella record collegati opzionali (profili)
  await supa.from('profiles').delete().eq('id', uid)

  // 2) Elimina auth user
  const { error } = await supa.auth.admin.deleteUser(uid)
  if(error) return new Response(JSON.stringify({ error: error.message }), { status: 400 })

  return new Response(JSON.stringify({ ok:true, user_id: uid }), { headers: { 'Content-Type': 'application/json' } })
}
