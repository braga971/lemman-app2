import { useState } from 'react'
import { supabase } from './_integration/supabaseClient.js'
import * as Icon from './components/Icons.jsx'
export default function Login(){
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [err,setErr]=useState('')
  async function onSubmit(e){
    e.preventDefault(); setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setErr(error.message)
  }
  return (
    <div className="container" style={{display:'grid', placeItems:'center', minHeight:'100vh'}}>
      <form onSubmit={onSubmit} className="card" style={{display:'grid', gap:10, width:360}}>
        <h2><Icon.Lock style={{marginRight:6}}/> Accedi</h2>
        <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
        {err && <div style={{color:'crimson'}}>{err}</div>}
        <button className="btn primary">Entra</button>
      </form>
    </div>
  )
}
