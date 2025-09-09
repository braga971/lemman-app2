import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY
function stub(){ return new Proxy({}, { get(){ throw new Error('Supabase non configurato: .env mancante') } }) }
export const supabase = (url && anon) ? createClient(url, anon, { auth:{ persistSession:true, autoRefreshToken:true } }) : stub()
