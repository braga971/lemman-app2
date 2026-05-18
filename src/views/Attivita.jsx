import { useEffect, useState } from 'react'
import { supabase } from '../_integration/supabaseClient.js'
import * as Icon from '../components/Icons.jsx'
import { AssegnaAttivitaPerCantiere } from './Amministrazione.jsx'
import { getSignedUrl } from '../_integration/signedUrl.js'

export default function Attivita({ user, db, refresh, isManager=false }){
  async function deletePhoto(t){
    try{
      const { data, error } = await supabase.functions.invoke('delete-activity-photo', { body: { taskId: t.id } })
      if (error) throw error
      if (!data?.ok) throw new Error('Eliminazione non riuscita')
      refresh()
    }catch(err){
      console.error('deletePhoto error', err)
      alert("Errore durante l'eliminazione della foto")
    }
  }

  function viewAndAutoDelete(t, url){
    try{
      if (!url){ alert('Foto non disponibile'); return }
      // Apri immediatamente per evitare blocco popup, poi cancella
      window.open(url, '_blank', 'noopener')
      setTimeout(()=>{ deletePhoto(t) }, 1500)
    }catch(err){ console.error('viewAndAutoDelete error', err); alert('Impossibile aprire la foto') }
  }

  const my = (db.tasks||[]).filter(t=>t.user_id===user.id).sort((a,b)=>a.data.localeCompare(b.data))
  const [signed, setSigned] = useState({})
  useEffect(()=>{
    (async()=>{
      const entries = await Promise.all(my.map(async t=>{
        if (t.photo_path){
          const url = await getSignedUrl('tasks-temp', t.photo_path, 3600)
          return [t.id, url]
        }
        return [t.id, t.photo_url || null]
      }))
      const map = {}
      for (const [id, url] of entries) map[id] = url
      setSigned(map)
    })()
  }, [my.map(t=>t.id).join('|'), my.map(t=>t.photo_path||'').join('|')])

  // Auto-cancellazione il giorno successivo se non vista
  useEffect(()=>{
    (async()=>{
      const now = Date.now()
      for (const t of my){
        const exp = t.photo_expires_at ? Date.parse(t.photo_expires_at) : null
        if (t.photo_path && exp && now >= exp){
          try{ await deletePhoto(t) } catch(_){ /* ignore */ }
        }
      }
    })()
  }, [my.map(t=>`${t.id}:${t.photo_path||''}:${t.photo_expires_at||''}`).join('|')])

  return (
    <div className="container" style={{paddingTop:16}}>
      <section className="card section">
        <h3><span className="icon-chip chip-attivita" style={{marginRight:6}}><Icon.ClipboardCheck/></span> Attività assegnate</h3>
        <table className="table">
          <thead><tr><th>Data</th><th>Titolo</th><th>Foto</th></tr></thead>
          <tbody>
            {my.map(t=>(
              <tr key={t.id}>
                <td>{t.data}</td>
                <td>{t.title}</td>
                <td>{(signed[t.id]) ? (
                  <button className="btn" onClick={()=>viewAndAutoDelete(t, signed[t.id])}>apri</button>
                ) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {isManager && (
        <section className="card section print-activities" style={{marginTop:16}}>
            <h3><span className="icon-chip chip-admin" style={{marginRight:6}}><Icon.Settings/></span> Assegna attività per cantiere</h3>
            <AssegnaAttivitaPerCantiere profiles={db.profiles||[]} onDone={refresh} />
          </section>
 
      )}
    </div>
  )
}
