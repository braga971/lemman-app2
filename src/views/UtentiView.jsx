import { useEffect, useState } from 'react'
import { supabase } from '../_integration/supabaseClient.js'
import * as Icon from '../components/Icons.jsx'

export default function UtentiView(){
  const [rows,setRows]=useState([])
  const [err,setErr]=useState('')
  const [loading,setLoading]=useState(false)
  const [form,setForm]=useState({ email:'', password:'', full_name:'', role:'user' })

  async function load(){
    setLoading(true); setErr('')
    const { data, error } = await supabase.from('profiles').select('*').order('created_at',{ascending:false})
    if(error){ setErr(error.message); setRows([]) } else { setRows(data||[]) }
    setLoading(false)
  }
  useEffect(()=>{ load() }, [])

  async function setRole(id, role){
    setErr('')
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
    if (error) setErr(error.message); else load()
  }

  async function createUser(e){
    e.preventDefault(); setErr('')
    if(!form.email?.trim() || !form.password?.trim()){
      setErr('Inserisci email e password'); return
    }
    try{
      setLoading(true)
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: { email: form.email.trim(), password: form.password, full_name: form.full_name?.trim() || null, role: form.role || 'user' },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      })
      if (error) throw error
      // Inserisci/aggiorna profilo lato DB (in caso l'edge function non lo faccia)
      if (data?.user_id){
        await supabase.from('profiles').upsert({ id: data.user_id, email: form.email.trim(), full_name: form.full_name?.trim() || null, role: form.role || 'user' })
      }
      setForm({ email:'', password:'', full_name:'', role:'user' })
      await load()
    } catch(e){
      let msg = String(e?.message || e)
      try{
        const ctx = e?.context
        const body = ctx?.body || ctx?.response?.error || ctx?.response?.message
        if (typeof body === 'string' && body.length) msg = body
      }catch(_){}
      setErr(msg)
    } finally {
      setLoading(false)
    }
  }

  async function deleteUser(row){
    if(!confirm(`Eliminare l'utente ${row.email}?`)) return
    setErr('')
    try{
      setLoading(true)
      const { error } = await supabase.functions.invoke('delete-user', { body: { id: row.id, email: row.email } })
      if (error) throw error
      // Non cancellare i rapportini: conserva il profilo marcandolo come archiviato
      await supabase.from('profiles').update({ role: 'archived' }).eq('id', row.id)
      await load()
    } catch(e){
      setErr(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  async function resetPassword(row){
    const pwd = prompt(`Nuova password per ${row.email}:`)
    if(!pwd) return
    setErr('')
    try{
      setLoading(true)
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      const { error } = await supabase.functions.invoke('reset-password', {
        body: { user_id: row.id, password: pwd },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      })
      if (error) throw error
      alert('Password aggiornata')
    } catch(e){
      setErr(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container" style={{paddingTop:16}}>
      <section className="card section">
        <h3><Icon.Users style={{marginRight:6}}/> Gestione Utenti</h3>
        <form onSubmit={createUser} style={{display:'grid', gridTemplateColumns:'1.5fr 1fr 1fr 0.8fr auto', gap:8, alignItems:'end', marginBottom:12}}>
          <div>
            <label>Email</label>
            <input className="input" type="email" value={form.email} onChange={e=>setForm(f=>({...f, email:e.target.value}))} required />
          </div>
          <div>
            <label>Password</label>
            <input className="input" type="password" value={form.password} onChange={e=>setForm(f=>({...f, password:e.target.value}))} required />
          </div>
          <div>
            <label>Nome completo</label>
            <input className="input" type="text" value={form.full_name} onChange={e=>setForm(f=>({...f, full_name:e.target.value}))} />
          </div>
          <div>
            <label>Ruolo</label>
            <select className="input" value={form.role} onChange={e=>setForm(f=>({...f, role:e.target.value}))}>
              <option value="user">User</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <button className="btn" type="submit" disabled={loading}><Icon.Plus /> Crea utente</button>
          </div>
        </form>
        {err && <div className="alert danger" style={{marginBottom:12}}>{err}</div>}
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr><th>Email</th><th>Nome</th><th>Ruolo</th><th>Creato</th><th></th></tr>
            </thead>
            <tbody>
              {rows?.length===0 && !loading && (
                <tr><td colSpan="5" style={{textAlign:'center', opacity:0.7}}>Nessun utente</td></tr>
              )}
              {rows?.map(r=>(
                <tr key={r.id}>
                  <td>{r.email || r.username || r.id}</td>
                  <td>{r.full_name || '—'}</td>
                  <td>
                    <select className="input" value={r.role || 'user'} onChange={e=>setRole(r.id, e.target.value)}>
                      <option value="user">User</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                      <option value="archived">Archived</option>
                    </select>
                  </td>
                  <td>{r.created_at ? new Date(r.created_at).toISOString().slice(0,19).replace('T',' ') : '—'}</td>
                  <td style={{textAlign:'right', display:'flex', gap:6, justifyContent:'flex-end'}}>
                    <button className="btn" onClick={()=>resetPassword(r)} disabled={loading} title="Reimposta password"><Icon.Lock /> Reset</button>
                    <button className="btn danger" onClick={()=>deleteUser(r)} disabled={loading}><Icon.Trash /> Elimina</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
