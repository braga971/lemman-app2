import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(url && anon)

function stub() {
  const noop = () => {}
  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: noop } } }),
      signInWithPassword: async () => ({ data: null, error: new Error('Backend non configurato') }),
      signOut: async () => ({ error: null })
    },
    from() {
      return {
        select() { return this },
        eq() { return this },
        order() { return Promise.resolve({ data: [], error: null }) },
        maybeSingle() { return Promise.resolve({ data: null, error: null }) }
      }
    },
    channel() {
      return {
        on() { return this },
        subscribe() { return { } }
      }
    },
    removeChannel: noop
  }
}

export const supabase = supabaseConfigured
  ? createClient(url, anon, { auth: { persistSession: true, autoRefreshToken: true } })
  : stub()
