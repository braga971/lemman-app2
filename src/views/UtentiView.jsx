import { useEffect, useState } from 'react'
import { supabase } from '../_integration/supabaseClient.js'
import * as Icon from '../components/Icons.jsx'

export default function UtentiView(){
  const [rows,setRows]=useState([])
  const [err,setErr]=useState('')
  const [loading,setLoading]=useState(false)
  const [form,setForm]=useState({ email:'', password:'', full_name:'', matricola:'', role:'user' })
  const [messageFor,setMessageFor]=useState(null)
  const [messageForm,setMessageForm]=useState({ message:'', expires_at:'' })
  const [messages,setMessages]=useState([])
  const [editingMessage,setEditingMessage]=useState(null)

  async function load(){
    setLoading(true); setErr('')
    await supabase.from('user_messages').delete().lt('expires_at', new Date().toISOString())
    const { data, error } = await supabase.from('profiles').select('*').order('matricola',{ascending:true, nullsFirst:false}).order('created_at',{ascending:true})
    if(error){ setErr(error.message); setRows([]) } else { setRows(data||[]) }
    const msgRes = await supabase.from('user_messages').select('*').order('created_at', { ascending:false })
    if (!msgRes.error) setMessages(msgRes.data || [])
    setLoading(false)
  }
  useEffect(()=>{ load() }, [])

  async function setRole(id, role){
    setErr('')
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
    if (error) setErr(error.message); else load()
  }

  async function setMatricola(id, matricola){
    setErr('')
    const value = String(matricola ?? '').trim()
    const { error } = await supabase.from('profiles').update({ matricola: value ? Number(value) : null }).eq('id', id)
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
      const matricolaValue = String(form.matricola ?? '').trim()
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: form.email.trim(),
          password: form.password,
          full_name: form.full_name?.trim() || null,
          matricola: matricolaValue ? Number(matricolaValue) : null,
          role: form.role || 'user'
        },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      })
      if (error) throw error
      setForm({ email:'', password:'', full_name:'', matricola:'', role:'user' })
      await load()
    } catch(e){
      let msg = String(e?.message || e)
      try{
        const ctx = e?.context
 
        const status = ctx?.response?.status || ctx?.status
        
        if (status === 404) msg = "Edge Function 'create-user' non trovata. Esegui 'supabase functions deploy create-user' e imposta i secrets."
        if (status === 401) msg = 'Non autorizzato. Effettua il login e riprova.'
        if (status === 403) msg = 'Accesso negato: solo i manager possono creare utenti.'
        if (status === 409) msg = 'Email già registrata. Usa un\'altra email oppure elimina l\'utente esistente.'
 
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
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      const { error } = await supabase.functions.invoke('delete-user', {
        body: { user_id: row.id, email: row.email },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      })
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

  async function sendMessage(e){
    e.preventDefault()
    if (!messageFor) return
    const text = String(messageForm.message || '').trim()
    if (!text){ setErr('Scrivi il messaggio da inviare'); return }
    if (!messageForm.expires_at){ setErr('Inserisci la data di scadenza del messaggio'); return }
    setErr('')
    try{
      setLoading(true)
      const payload = {
        user_id: messageFor.id,
        message: text,
        expires_at: `${messageForm.expires_at}T23:59:59`,
      }
      const { error } = editingMessage
        ? await supabase.from('user_messages').update(payload).eq('id', editingMessage.id)
        : await supabase.from('user_messages').insert(payload)
      if (error) throw error
      setMessageFor(null)
      setEditingMessage(null)
      setMessageForm({ message:'', expires_at:'' })
      await load()
      alert(editingMessage ? 'Messaggio modificato' : 'Messaggio inviato')
    }catch(e){
      setErr(String(e?.message || e))
    }finally{
      setLoading(false)
    }
  }

  async function deleteMessage(message){
    if (!confirm('Cancellare questo messaggio?')) return
    setErr('')
    try{
      setLoading(true)
      const { error } = await supabase.from('user_messages').delete().eq('id', message.id)
      if (error) throw error
      await load()
    }catch(e){
      setErr(String(e?.message || e))
    }finally{
      setLoading(false)
    }
  }

  function openEditMessage(message){
    const target = rows.find(r=>r.id===message.user_id) || { id: message.user_id, email: message.user_id }
    setMessageFor(target)
    setEditingMessage(message)
    setMessageForm({
      message: message.message || '',
      expires_at: String(message.expires_at || '').slice(0,10),
    })
  }

  return (
    <div className="container" style={{paddingTop:16}}>
      <section className="card section">
        <h3><Icon.Users style={{marginRight:6}}/> Gestione Utenti</h3>
        <form onSubmit={createUser} style={{display:'grid', gridTemplateColumns:'1.5fr 1fr 1fr 0.6fr 0.8fr auto', gap:8, alignItems:'end', marginBottom:12}}>
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
            <label>Matricola</label>
            <input className="input" type="number" min="1" value={form.matricola} onChange={e=>setForm(f=>({...f, matricola:e.target.value}))} />
          </div>
          <div>
            <label>Ruolo</label>
            <select className="input" value={form.role} onChange={e=>setForm(f=>({...f, role:e.target.value}))}>
              <option value="user">Dipendente</option>
              <option value="manager">Manager</option>
              <option value="mensa">Mensa</option>
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
              <tr><th>Matricola</th><th>Email</th><th>Nome</th><th>Ruolo</th><th>Creato</th><th>Azioni</th></tr>
            </thead>
            <tbody>
              {rows?.length===0 && !loading && (
                <tr><td colSpan="6" style={{textAlign:'center', opacity:0.7}}>Nessun utente</td></tr>
              )}
              {rows?.map(r=>(
                <tr key={r.id}>
                  <td style={{width:110}}>
                    <input
                      className="input"
                      type="number"
                      min="1"
                      defaultValue={r.matricola ?? ''}
                      onBlur={e=>setMatricola(r.id, e.target.value)}
                    />
                  </td>
                  <td>{r.email || r.username || r.id}</td>
                  <td>{r.full_name || '—'}</td>
                  <td>
                    <select className="input" value={r.role || 'user'} onChange={e=>setRole(r.id, e.target.value)}>
                      <option value="user">Dipendente</option>
                      <option value="manager">Manager</option>
                      <option value="mensa">Mensa</option>
                      <option value="archived">Licenziato</option>
                    </select>
                  </td>
                  <td>{r.created_at ? new Date(r.created_at).toISOString().slice(0,19).replace('T',' ') : '—'}</td>
                  <td style={{textAlign:'right', display:'flex', gap:6, justifyContent:'flex-end'}}>
                    <button className="btn" onClick={()=>resetPassword(r)} disabled={loading} title="Reimposta password"><Icon.Lock /> Reset</button>
                    <button className="btn secondary" onClick={()=>{ setMessageFor(r); setMessageForm({ message:'', expires_at:'' }) }} disabled={loading} title="Invia messaggio">Invia messaggio</button>
                    <button className="btn danger" onClick={()=>deleteUser(r)} disabled={loading} title="Elimina utente">Elimina</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card section" style={{marginTop:16}}>
        <h3><Icon.Megaphone style={{marginRight:6}}/> Messaggi inviati</h3>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr><th>Dipendente</th><th>Messaggio</th><th>Scadenza</th><th>Stato</th><th>Azioni</th></tr>
            </thead>
            <tbody>
              {messages.length===0 && (
                <tr><td colSpan="5" style={{textAlign:'center', opacity:0.7}}>Nessun messaggio inviato</td></tr>
              )}
              {messages.map(m=>{
                const p = rows.find(r=>r.id===m.user_id)
                const expired = m.expires_at && new Date(m.expires_at) < new Date()
                return (
                  <tr key={m.id}>
                    <td>{p?.full_name || p?.email || m.user_id}</td>
                    <td style={{whiteSpace:'pre-wrap'}}>{m.message}</td>
                    <td>{m.expires_at ? new Date(m.expires_at).toLocaleDateString('it-IT') : '-'}</td>
                    <td><span className="badge">{expired ? 'Scaduto' : 'Attivo'}</span></td>
                    <td style={{display:'flex', gap:6, justifyContent:'flex-end'}}>
                      <button className="btn secondary" onClick={()=>openEditMessage(m)} disabled={loading}>Modifica</button>
                      <button className="btn danger" onClick={()=>deleteMessage(m)} disabled={loading}>Cancella</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
      {messageFor && (
        <div className="search-overlay" onClick={()=>{ setMessageFor(null); setEditingMessage(null) }}>
          <form className="search-panel" style={{padding:14}} onClick={e=>e.stopPropagation()} onSubmit={sendMessage}>
            <h3 style={{marginTop:0}}>{editingMessage ? 'Modifica messaggio' : 'Invia messaggio'}</h3>
            <div className="muted" style={{marginBottom:10}}>{messageFor.full_name || messageFor.email}</div>
            <div className="grid" style={{gap:10}}>
              <textarea className="input" rows={5} placeholder="Messaggio" value={messageForm.message} onChange={e=>setMessageForm(f=>({...f, message:e.target.value}))} />
              <div>
                <label>Scadenza</label>
                <input className="input" type="date" value={messageForm.expires_at} onChange={e=>setMessageForm(f=>({...f, expires_at:e.target.value}))} />
              </div>
              <div className="row" style={{justifyContent:'flex-end'}}>
                <button type="button" className="btn secondary" onClick={()=>{ setMessageFor(null); setEditingMessage(null) }}>Annulla</button>
                <button type="submit" className="btn" disabled={loading}>{editingMessage ? 'Salva' : 'Invia'}</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

