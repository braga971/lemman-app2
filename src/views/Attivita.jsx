import { useState } from 'react'
import { supabase } from '../_integration/supabaseClient.js'
import * as Icon from '../components/Icons.jsx'
import { AssegnaAttivitaPerCantiere, RiepilogoAttivita } from './Amministrazione.jsx'

export default function Attivita({ user, db, refresh, isManager=false }){
  async function deletePhoto(t){
    try{
      if (t.photo_path){
        await supabase.storage.from('tasks-temp').remove([t.photo_path])
      }
      await supabase.from('tasks').update({ photo_url:null, photo_path:null, photo_expires_at:null }).eq('id', t.id)
      refresh()
    }catch(err){
      console.error('deletePhoto error', err)
      alert('Errore durante l\'eliminazione della foto')
    }
  }

  const my = (db.tasks||[]).filter(t=>t.user_id===user.id && t.stato!=='done').sort((a,b)=>a.data.localeCompare(b.data))
  async function toggle(t){ await supabase.from('tasks').update({ stato: t.stato==='done'?'todo':'done' }).eq('id', t.id); refresh() }
  return (
    <div className="container" style={{paddingTop:16}}>
      <section className="card section">
        <h3><span className="icon-chip chip-attivita" style={{marginRight:6}}><Icon.ClipboardCheck/></span> Attività assegnate</h3>
        <table className="table">
          <thead><tr><th>Data</th><th>Titolo</th><th>Foto</th><th>Stato</th><th></th></tr></thead>
          <tbody>
            {my.map(t=>(
              <tr key={t.id}>
                <td>{t.data}</td>
                <td>{t.title}</td>
                <td>{t.photo_url ? (<><a href={t.photo_url} target="_blank" rel="noreferrer">apri</a> <button className="btn danger" style={{marginLeft:8}} onClick={()=>deletePhoto(t)}><span style={{display:'inline-flex',gap:6,alignItems:'center'}}><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg> Elimina foto</span></button></>) : '—'}</td>
                <td><span className="badge" style={{background:t.stato==='done'?'var(--green)':'var(--gray)'}}>{t.stato||'Da fare'}</span></td>
                <td><button className="btn" onClick={()=>toggle(t)}>{t.stato==='done'?'Segna da fare':'Completa'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {isManager && (
        <>
          <section className="card section print-activities" style={{marginTop:16}}>
            <h3><span className="icon-chip chip-admin" style={{marginRight:6}}><Icon.Settings/></span> Assegna attività per cantiere</h3>
            <AssegnaAttivitaPerCantiere profiles={db.profiles||[]} onDone={refresh} />
          </section>
          <section className="card section print-riepilogo" style={{marginTop:16}}>
            <ManagerRiepilogoWrapper db={db} />
          </section>
        </>
      )}
    </div>
  )
}

function ManagerRiepilogoWrapper({ db }){
  const [dateRep, setDateRep] = useState(new Date().toISOString().slice(0,10))
  return (
    <div>
      <div className="row" style={{marginBottom:8}}>
        <label>Data:</label>
        <input type="date" className="input" value={dateRep} onChange={e=>setDateRep(e.target.value)} />
      </div>
      <RiepilogoAttivita db={db} date={dateRep} />
    </div>
  )
}
