import { supabase } from './supabaseClient.js'

export async function getSignedUrl(bucket, path, expiresIn = 3600){
  try{
    const { data, error } = await supabase.functions.invoke('get-signed-url', { body: { bucket, path, expiresIn } })
    if (error) throw error
    const url = data?.signedUrl || data?.url || null
    return url
  }catch(e){
    console.warn('getSignedUrl error', e)
    return null
  }
}

