
// ---- Photo deletion helpers (Supabase Storage) ----
function parseStoragePublicUrl(url){
  try{
    // format: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path...>
    const i = url.indexOf('/storage/v1/object/public/')
    if (i === -1) return null
    const rest = url.slice(i + '/storage/v1/object/public/'.length)
    const slash = rest.indexOf('/')
    if (slash === -1) return null
    const bucket = rest.slice(0, slash)
    const path = rest.slice(slash + 1)
    return { bucket, path }
  }catch(e){ return null }
}

async function deletePhotoForTask(t){
  try{
    if (!t || !t.photo_url) return
    const info = parseStoragePublicUrl(t.photo_url)
    if (!info){ 
      // Fallback: only clear field
      await supabase.from('tasks').update({ photo_url: null }).eq('id', t.id)
      return
    }
    const { error: remErr } = await supabase.storage.from(info.bucket).remove([info.path])
    if (remErr){ alert(remErr.message); return }
    const { error: updErr } = await supabase.from('tasks').update({ photo_url: null }).eq('id', t.id)
    if (updErr){ alert(updErr.message); return }
  }catch(err){
    alert(String(err))
  }
}
import { supabase } from '../_integration/supabaseClient.js'
import * as Icon from '../components/Icons.jsx'

function dayKeyLocal(d){
  const dt = new Date(d)
  const y = dt.getFullYear()
  const m = String(dt.getMonth()+1).padStart(2,'0')
  const dd = String(dt.getDate()).padStart(2,'0')
  return `${y}-${m}-${dd}`
}

export default function Home({ user, profile, db }){
  const now = new Date()
  const today = dayKeyLocal(now)
  const yesterday = dayKeyLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate()-1))
  const tomorrow = dayKeyLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate()+1))

  const myTasks = (db.tasks||[]).filter(t=>t.user_id===user.id)
  const byDay = { [yesterday]:[], [today]:[], [tomorrow]:[] }
  for (const t of myTasks){ if (byDay[t.data]) byDay[t.data].push(t) }

  async function toggle(t){
    const next = t.stato==='done'?'todo':'done'
    await supabase.from('tasks').update({ stato: next }).eq('id', t.id)
    // Se l'attività è completata, rimuovi foto per liberare spazio
    if (next === 'done'){
      try{ await deletePhotoForTask(t) }catch(_){ /* ignore */ }
    }
  }


  function viewTitle(str){
    try{
      const s = String(str||'').replace(/\\u00B0/g, '°')
      return s.replace(/^1.*TURNO/, '1° TURNO')
              .replace(/^2.*TURNO/, '2° TURNO')
              .replace(/^3.*TURNO/, '3° TURNO')
    }catch(_){ return String(str||'') }
  }  return (
    <div className="container" style={{paddingTop:16}}>
      <div className="card section" style={{marginBottom:12}}>
        <h3><Icon.Home style={{marginRight:6}}/> Benvenuto{profile?.full_name ? `, ${profile.full_name}` : user?.email ? `, ${user.email}` : ''}</h3>
      </div>
      <div className="grid2">
        <section className="card section">
          <h3><Icon.ClipboardCheck style={{marginRight:6}}/> Le mie attività</h3>

          {([yesterday,today,tomorrow]).map(day=>(
            <div key={day} style={{marginTop:8}}>
              <h4 style={{margin:'6px 0'}}>{day===yesterday?'Ieri':day===today?'Oggi':'Domani'} <small>({day})</small></h4>
              {(byDay[day]||[]).length===0 ? <div className="muted">Nessuna attività</div> : (
                (()=>{
                  const groups = {}
                  for(const t of byDay[day]){ const k=t.cantiere||'(Senza cantiere)'; (groups[k]??=[]).push(t) }
                  const order = Object.entries(groups).sort((a,b)=> a[0].localeCompare(b[0]))
                  return (
                    <div>
                      {order.map(([cant,list])=> (
                        <div key={cant} style={{margin:'6px 0'}}>
                          <div className="muted" style={{fontWeight:600, marginBottom:2}}>{cant}</div>
                          <ul style={{margin:0,paddingLeft:16}}>
                            {list.map(t=> (
                              <li key={t.id} style={{display:'flex',alignItems:'center',gap:8, margin:'4px 0'}}>
                                <button className="btn" onClick={()=>toggle(t)}>{t.stato==='done'?'✅':'⬜️'}</button>
                                <span style={{textDecoration: t.stato==='done'?'line-through':'none'}}>{(typeof viewTitle==='function'?viewTitle(t.title):t.title)}</span>
                                {t.photo_url && (<><a href={t.photo_url} target="_blank" rel="noreferrer" style={{marginLeft:8}}>foto</a><button className="btn danger" style={{marginLeft:6}} onClick={()=>deletePhotoForTask(t)}><span style={{display:'inline-flex',gap:6,alignItems:'center'}}><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg> Elimina foto</span></button></>)}
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
          <h3><Icon.Users style={{marginRight:6}}/> Attività di squadra — ieri/oggi/domani</h3>
          {([yesterday,today,tomorrow]).map(day=>{
            const dayTasks = (db.tasks||[]).filter(t=>t.data===day)
            if (dayTasks.length===0) return (
              <div key={day} style={{marginTop:8}}>
                <h4 style={{margin:'6px 0'}}>{day===yesterday?'Ieri':day===today?'Oggi':'Domani'} <small>({day})</small></h4>
                <div className="muted">Nessuna attività</div>
              </div>
            )
            // group by user
            const byUser = {}
            for (const t of dayTasks){ (byUser[t.user_id]??=[]).push(t) }
            const order = Object.entries(byUser).sort((a,b)=>{
              const A = (db.profiles||[]).find(p=>p.id===a[0])?.full_name||''
              const B = (db.profiles||[]).find(p=>p.id===b[0])?.full_name||''
              return A.localeCompare(B)
            })
            return (
              <div key={day} style={{marginTop:8}}>
                <h4 style={{margin:'6px 0'}}>{day===yesterday?'Ieri':day===today?'Oggi':'Domani'} <small>({day})</small></h4>
                {order.map(([uid,list])=>{
                  const name=(db.profiles||[]).find(p=>p.id===uid)?.full_name || (db.profiles||[]).find(p=>p.id===uid)?.email || '—'
                  return (
                    <div key={uid} style={{margin:'4px 0 10px 0'}}>
                      <div className="muted" style={{fontWeight:600, marginBottom:4}}>{name}</div>
                      <ul style={{margin:0,paddingLeft:16}}>
                        {list.map(t=>(
                          <li key={t.id} style={{display:'flex',alignItems:'center',gap:8, margin:'4px 0'}}>
                            <button className="btn" onClick={()=>toggle(t)}>{t.stato==='done'?'✅':'⬜️'}</button>
                            <span style={{textDecoration: t.stato==='done'?'line-through':'none'}}>{(typeof viewTitle==='function'?viewTitle(t.title):t.title)}</span>
                            {t.photo_url && (<><a href={t.photo_url} target="_blank" rel="noreferrer" style={{marginLeft:8}}>foto</a><button className="btn danger" style={{marginLeft:6}} onClick={()=>deletePhotoForTask(t)}><span style={{display:'inline-flex',gap:6,alignItems:'center'}}><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg> Elimina foto</span></button></>)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </section>
      )}

      </div>

      
<div className="card section" style={{marginTop:16}}>
        <h3><Icon.Megaphone style={{marginRight:6}}/> Bacheca</h3>
        <ul style={{margin:0,paddingLeft:16}}>
          {(db.bacheca||[]).map(b=>(
            <li key={b.id}>
              <b>{b.title||'—'}</b>
              <span className="muted"> ({new Date(b.created_at).toLocaleString()})</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

