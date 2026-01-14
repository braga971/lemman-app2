import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

// Minimal helper: only allow POST with Authorization: Bearer <SERVICE_ROLE_KEY>
serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: { 'Content-Type': 'application/json', ...cors } })
  }

  try {
    const DB_URL = Deno.env.get('SUPABASE_DB_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    if (!DB_URL || !SUPABASE_URL) {
      return new Response(JSON.stringify({ error: 'Missing secrets (SUPABASE_DB_URL / SUPABASE_URL)' }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } })
    }

    const authz = req.headers.get('Authorization') || ''
    let ok = false
    if (authz.toLowerCase().startsWith('bearer ')) {
      const token = authz.split(' ')[1]
      try {
        const payloadB64 = token.split('.')[1]
        const json = JSON.parse(atob(payloadB64)) as { role?: string; ref?: string }
        const expectedRef = SUPABASE_URL.replace(/^https?:\/\//,'').split('.')[0]
        ok = (json?.role === 'service_role') && (!!json?.ref && json.ref === expectedRef)
      } catch (_) {
        ok = false
      }
    }
    // Fallback: if secret is configured and matches exactly, also allow
    if (!ok && SERVICE_ROLE_KEY && authz.split(' ')[1] === SERVICE_ROLE_KEY) ok = true
    if (!ok) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json', ...cors } })

    // Connect to Postgres using Deno Postgres driver
    // deno-lint-ignore no-explicit-any
    const { Client } = await import('https://deno.land/x/postgres@v0.17.0/mod.ts') as any
    const client = new Client(DB_URL)
    await client.connect()
    try {
      // Disable RLS on auth tables
      await client.queryArray(`alter table auth.users disable row level security;`)
      await client.queryArray(`alter table auth.identities disable row level security;`)

      // Drop any policies that might exist on these tables
      const pol = await client.queryObject<{ policyname: string; tablename: string }>(
        `select policyname, tablename from pg_policies where schemaname='auth' and tablename in ('users','identities')`
      )
      for (const p of pol.rows) {
        await client.queryArray(`drop policy ${p.policyname} on auth.${p.tablename};`)
      }

      // Reindex (optional, harmless)
      await client.queryArray(`reindex table auth.users;`)
      await client.queryArray(`reindex table auth.identities;`)

      // Verify
      const ver = await client.queryObject<{ relname: string; relrowsecurity: boolean }>(
        `select c.relname, c.relrowsecurity
         from pg_class c
         join pg_namespace n on n.oid=c.relnamespace
         where n.nspname='auth' and c.relname in ('users','identities')`
      )

      return new Response(JSON.stringify({ ok: true, verify: ver.rows }), { headers: { 'Content-Type': 'application/json', ...cors } })
    } finally {
      await client.end()
    }
  } catch (e) {
    console.error('fix-auth-rls error', e)
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
