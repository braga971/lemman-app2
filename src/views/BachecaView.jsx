import { useState } from 'react'
import { supabase } from '../_integration/supabaseClient.js'

export default function BachecaView({ data, refresh, isManager=false }){
  const [title,setTitle]=useState('')
  const [msg,setMsg]=useState('')
  const [editingId,setEditingId]=useState(null)
  const [editTitle,setEditTitle]=useState('')
  const [editMsg,setEditMsg]=useState('')

  async function post(){
    await supabase.from('bacheca').insert({ title, message: msg })
    setTitle(''); setMsg(''); refresh()
  }
  async function del(id){ await supabase.from('bacheca').delete().eq('id', id); refresh() }
  function startEdit(r){ setEditingId(r.id); setEditTitle(r.title||''); setEditMsg(r.message||'') }
  async function saveEdit(){
    await supabase.from('bacheca').update({ title: editTitle, message: editMsg }).eq('id', editingId)
    setEditingId(null); refresh()
  }

  return (
    <div className="grid">
      {isManager && (
        <div className="card">
          <div className="row">
            <input className="input" placeholder="Titolo" value={title} onChange={e=>setTitle(e.target.value)} />
            <input className="input" placeholder="Messaggio" style={{minWidth:320}} value={msg} onChange={e=>setMsg(e.target.value)} />
            <button className="btn" onClick={post} disabled={!msg}>Pubblica</button>
          </div>
        </div>
      )}
      <div className="card">
        <ul style={{listStyle:'none', padding:0, margin:0}}>
          {(data.bacheca||[]).map(b=>(
            <li key={b.id} className="row" style={{justifyContent:'space-between', borderBottom:'1px solid var(--border)', padding:'6px 0'}}>
              {editingId===b.id ? (
                <div className="row" style={{flex:1}}>
                  <input className="input" placeholder="Titolo" value={editTitle} onChange={e=>setEditTitle(e.target.value)} />
                  <input className="input" placeholder="Messaggio" value={editMsg} onChange={e=>setEditMsg(e.target.value)} style={{minWidth:300}}/>
                </div>
              ) : (
                <div style={{display:'grid'}}>
                  <strong>{b.title||'Annuncio'}</strong>
                  <span>{b.message}</span>
                </div>
              )}
              {isManager && (
                <div className="row">
                  {editingId===b.id ? (
                    <>
                      <button className="btn" onClick={saveEdit}><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Salva</button>
                      <button className="btn secondary" onClick={()=>setEditingId(null)}>Annulla</button>
                    </>
                  ) : (
                    <>
                      <button className="btn" onClick={()=>startEdit(b)}><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3l4 4L7 21H3v-4L17 3z"/></svg> Modifica</button>
                      <button className="btn secondary" onClick={()=>del(b.id)}>Rimuovi</button>
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
