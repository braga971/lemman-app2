import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient.js'

export function useAuth(){
  const [user,setUser]=useState(null)
  useEffect(()=>{
    supabase.auth.getUser().then(({data})=>setUser(data.user??null))
    const { data:sub } = supabase.auth.onAuthStateChange((_e,session)=>setUser(session?.user??null))
    return ()=> sub.subscription.unsubscribe()
  },[])
  return user
}

export function useProfile(user){
  const [profile,setProfile]=useState(null)
  useEffect(()=>{
    if(!user){ setProfile(null); return }
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle().then(({data})=>setProfile(data))
  },[user])
  return profile
}
