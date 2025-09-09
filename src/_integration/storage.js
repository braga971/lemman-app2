/* _integration/storage.js */
import { supabase } from './supabaseClient.js'

export async function uploadPublic(bucket, file, prefix=''){
  const ext = file.name.split('.').pop()
  const name = `${prefix}${crypto.randomUUID()}.${ext}`
  const { data, error } = await supabase.storage.from(bucket).upload(name, file, { upsert: false })
  if (error) throw error
  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(data.path)
  return pub.publicUrl
}
