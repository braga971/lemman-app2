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
  function growTextarea(e){
    const el = e.currentTarget
    el.style.height = 'auto'
    el.style.height = `${Math.max(150, el.scrollHeight)}px`
  }
  async function saveEdit(){
    await supabase.from('bacheca').update({ title: editTitle, message: editMsg }).eq('id', editingId)
    setEditingId(null); refresh()
  }

  return (
    <div className="grid">
      {isManager && (
        <div className="card">
          <div style={{display:'grid', gap:10}}>
            <input className="input" placeholder="Titolo" value={title} onChange={e=>setTitle(e.target.value)} />
            <textarea className="input" placeholder="Messaggio" rows={6} style={{width:'100%', minHeight:150, resize:'vertical', lineHeight:1.45}} value={msg} onInput={growTextarea} onChange={e=>setMsg(e.target.value)} />
            <div><button className="btn" onClick={post} disabled={!msg}>Pubblica</button></div>
          </div>
        </div>
      )}
      <div className="card">
        <ul style={{listStyle:'none', padding:0, margin:0}}>
          {(data.bacheca||[]).map(b=>(
            <li key={b.id} className="row" style={{justifyContent:'space-between', borderBottom:'1px solid var(--border)', padding:'6px 0'}}>
              {editingId===b.id ? (
                <div style={{display:'grid', gap:8, flex:1}}>
                  <input className="input" placeholder="Titolo" value={editTitle} onChange={e=>setEditTitle(e.target.value)} />
                  <textarea className="input" placeholder="Messaggio" value={editMsg} rows={6} onInput={growTextarea} onChange={e=>setEditMsg(e.target.value)} style={{width:'100%', minHeight:150, resize:'vertical', lineHeight:1.45}}/>
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
