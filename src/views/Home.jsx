import { useState } from 'react'
import { supabase } from '../_integration/supabaseClient.js'
import * as Icon from '../components/Icons.jsx'
import { RiepilogoAttivita } from './Amministrazione.jsx'

export default function Home({ user, profile, db }){
  const displayName = profile?.full_name ? `, ${profile.full_name}` : (user?.email ? `, ${user.email}` : '')
  const [mgrDate, setMgrDate] = useState(new Date().toISOString().slice(0,10))
  const dayKeyLocal = (d)=>{ const dt=new Date(d); const y=dt.getFullYear(); const m=String(dt.getMonth()+1).padStart(2,'0'); const dd=String(dt.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}` }
  const now = new Date()
  const today = dayKeyLocal(now)
  const yesterday = dayKeyLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate()-1))
  const tomorrow = dayKeyLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate()+1))
  const myTasks = (db.tasks||[]).filter(t=>t.user_id===user.id)
  const byDay = { [yesterday]:[], [today]:[], [tomorrow]:[] }
  for(const t of myTasks){ if(byDay[t.data]) byDay[t.data].push(t) }
  const viewTitle = (str)=>{
    try{
      const s = String(str||'').replace(/\u00B0/g,'°')
      return s
        .replace(/^1.*TURNO/,'1° TURNO')
        .replace(/^2.*TURNO/,'2° TURNO')
        .replace(/^3.*TURNO/,'3° TURNO')
    }catch(_){ return String(str||'') }
  }
  async function toggleTask(t){ const next = t.stato==='done'?'todo':'done'; await supabase.from('tasks').update({ stato: next }).eq('id', t.id) }
  return (
    <div className="container" style={{paddingTop:16}}>
      <div className="card section" style={{marginBottom:12}}>
        <h3><span className="icon-chip chip-home" style={{marginRight:6}}><Icon.Home/></span> Benvenuto{displayName}</h3>
      </div>

      <section className="card section" style={{marginTop:6}}>
        <h3><span className="icon-chip chip-attivita" style={{marginRight:6}}><Icon.ClipboardCheck/></span> Le mie attività</h3>
        {[yesterday, today, tomorrow].map(day => (
          <div key={day} style={{marginTop:8}}>
            <h4 style={{margin:'6px 0'}}>{day===yesterday?'Ieri':day===today?'Oggi':'Domani'} <small>({day})</small></h4>
            {(byDay[day]||[]).length===0 ? (
              <div className="muted">Nessuna attività</div>
            ) : (
              (()=>{
                const groups={}; for(const t of byDay[day]){ const k=t.cantiere||'(Senza cantiere)'; (groups[k]??=[]).push(t) }
                const order = Object.entries(groups).sort((a,b)=> a[0].localeCompare(b[0]))
                return (
                  <div>
                    {order.map(([cant,list])=>(
                      <div key={cant} style={{margin:'6px 0'}}>
                        <div className="muted" style={{fontWeight:600, marginBottom:2}}>{cant}</div>
                        <ul style={{margin:0,paddingLeft:16}}>
                          {list.map(t=>(
                            <li key={t.id} style={{display:'flex',alignItems:'center',gap:8, margin:'4px 0'}}>
                              <button className="btn" onClick={()=>toggleTask(t)}>{t.stato==='done' ? '✓' : '○'}</button>
                              <span style={{textDecoration: t.stato==='done'?'line-through':'none'}}>{viewTitle(t.title)}</span>
                              <span className="badge" style={{marginLeft:6}}>{t.stato==='done' ? 'fatta' : 'da completare'}</span>
                              {t.photo_url && <a href={t.photo_url} target="_blank" rel="noreferrer" style={{marginLeft:8}}>foto</a>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )
              })()
            )}
          </div>
        ))}
      </section>

      {profile && (profile.role==='manager' || profile.is_manager) && (
        <section className="card section" style={{marginTop:16}}>
          <h3><span className="icon-chip chip-attivita" style={{marginRight:6}}><Icon.ClipboardCheck/></span> Attività per cantiere</h3>
          <div className="row" style={{gap:8, alignItems:'center', margin:'6px 0 10px'}}>
            <label>Data:</label>
            <input type="date" className="input" value={mgrDate} onChange={e=>setMgrDate(e.target.value)} />
          </div>
          <RiepilogoAttivita db={db} date={mgrDate} />
        </section>
      )}

      <div className="card section" style={{marginTop:16}}>
        <h3><span className="icon-chip chip-bacheca" style={{marginRight:6}}><Icon.Megaphone/></span> Bacheca</h3>
        <ul style={{margin:0,paddingLeft:16}}>
          {(db?.bacheca||[]).map(b=>(
            <li key={b.id} style={{margin:'6px 0'}}>
              <div style={{fontWeight:700}}>{b.title||'-'} <span className="muted">({new Date(b.created_at).toLocaleString()})</span></div>
              {b.message && <div className="muted" style={{whiteSpace:'pre-wrap'}}>{b.message}</div>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
