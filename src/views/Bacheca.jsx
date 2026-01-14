import { useState } from 'react'
import { supabase } from '../_integration/supabaseClient.js'
import * as Icon from '../components/Icons.jsx'

export default function Bacheca({ db, isManager, refresh }){
  const [msg,setMsg]=useState('')
  const [title,setTitle]=useState('')
  async function post(){ await supabase.from('bacheca').insert({ title, message: msg }); setMsg(''); setTitle(''); refresh() }
  async function del(id){ await supabase.from('bacheca').delete().eq('id', id); refresh() }
  return (
    <div className="container" style={{paddingTop:16, display:'grid', gap:16}}>
      <section className="card section">
        <h3><span className="icon-chip chip-bacheca" style={{marginRight:6}}><Icon.Megaphone/></span> Bacheca</h3>
        {isManager && (
          <div className="row" style={{marginBottom:8}}>
            <input placeholder="Titolo" value={title} onChange={e=>setTitle(e.target.value)} />
            <input placeholder="Messaggio" value={msg} onChange={e=>setMsg(e.target.value)} style={{minWidth:320}}/>
            <button className="btn" onClick={post} disabled={!msg}>Pubblica</button>
          </div>
        )}
        <ul style={{margin:0,paddingLeft:16}}>
          {(db.bacheca||[]).map(b=>(
            <li key={b.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid #eee'}}>
              <span><b>{b.title||'•'}</b> {b.message} <span className="subtitle">({new Date(b.created_at).toLocaleString()})</span></span>
              {isManager && <button className="btn" onClick={()=>del(b.id)}><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg> Elimina</button>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
