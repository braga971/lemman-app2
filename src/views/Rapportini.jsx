import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../_integration/supabaseClient.js'
import * as Icon from '../components/Icons.jsx'
import imageCompression from 'browser-image-compression'

export default function Rapportini({ user, db, refresh, isManager=false }){
  const [form,setForm]=useState({ data:new Date().toISOString().slice(0,10), ore:'', commessa_id:'', posizione_id:'', cantiere:'', descrizione:'', file:null })
  const [forUser,setForUser]=useState(user.id)
  const pos = useMemo(()=> (db.posizioni||[]).filter(p=>p.commessa_id===form.commessa_id), [db.posizioni, form.commessa_id])
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate()-weekStart.getDay()+1); weekStart.setHours(0,0,0,0)
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate()+6); weekEnd.setHours(23,59,59,999)
  const mine = (db.rapportini||[]).filter(r=> r.user_id===user.id && new Date(r.data)>=weekStart && new Date(r.data)<=weekEnd)

  useEffect(()=>{
    // auto-compila cantiere quando cambia commessa
    const c = (db.commesse||[]).find(x=>x.id===form.commessa_id)
    if (c && c.cantiere_binded){ setForm(f=>({ ...f, cantiere: c.cantiere || '' })) }
  }, [form.commessa_id, db.commesse])

  async function handleFile(e){
    const file = e.target.files?.[0] || null;
    if (!file) { setForm(f=>({...f, file:null})); return }
    try{
      const compressed = await imageCompression(file, { maxSizeMB: 0.8, maxWidthOrHeight: 1600, useWebWorker: true });
      const outFile = new File([compressed], file.name.replace(/(\.[a-z0-9]+)$/i, '_compressed$1'), { type: compressed.type });
      setForm(f=>({...f, file: outFile }));
    } catch(err){
      console.error('Compressione immagine fallita', err);
      setForm(f=>({...f, file }));
    }
  }

  async function onSubmit(){
    // Validazione campi obbligatori
    const missing = []
    if (!form.data) missing.push('data')
    if (!form.ore || Number(form.ore) <= 0) missing.push('ore')
    if (!form.commessa_id) missing.push('commessa')
    if (!form.posizione_id) missing.push('posizione')
    if (!form.cantiere || String(form.cantiere).trim()==='') missing.push('cantiere')
    if (!form.descrizione || String(form.descrizione).trim()==='') missing.push('descrizione')
    if (missing.length){
      alert('Per inserire il rapportino devi compilare: ' + missing.join(', '))
      return
    }
    let photo_url = null
    if (form.file){
      const path = `${user.id}/${Date.now()}_${form.file.name}`
      const up = await supabase.storage.from('rapportini-foto').upload(path, form.file, { cacheControl:'3600', upsert:false })
      if (!up.error){
        const { data } = await supabase.storage.from('rapportini-foto').getPublicUrl(path)
        photo_url = data.publicUrl
      }
    }
    const { error } = await supabase.from('rapportini').insert({
      user_id: forUser || user.id, data: form.data, ore: Number(form.ore||0),
      commessa_id: form.commessa_id || null, posizione_id: form.posizione_id || null,
      cantiere: form.cantiere || null, descrizione: form.descrizione || null,
      photo_url
    })
    if (error) alert(error.message); else { setForm({ data:new Date().toISOString().slice(0,10), ore:'', commessa_id:'', posizione_id:'', cantiere:'', descrizione:'', file:null }); refresh() }
  }

  return (
    <div className="container" style={{paddingTop:16}}>
      <section className="card section">
        <h3><Icon.FileText style={{marginRight:6}}/> Nuovo rapportino</h3>
        <div className="grid3">
          {isManager && (
            <select value={forUser} onChange={e=>setForUser(e.target.value)}>
              <option value={user.id}>- Me stesso -</option>
              {(db.profiles||[]).sort((a,b)=> (a.full_name||a.email||'').localeCompare(b.full_name||b.email||'')).map(p=> (
                <option key={p.id} value={p.id}>{p.full_name||p.email||p.id}</option>
              ))}
            </select>
          )}
          <input type="date" value={form.data} onChange={e=>setForm({...form, data:e.target.value})}/>
          <input type="number" min="0" step="0.5" placeholder="Ore" value={form.ore} onChange={e=>setForm({...form, ore:e.target.value})}/>
          <select value={form.commessa_id} onChange={e=>setForm({...form, commessa_id:e.target.value})}>
            <option value="">- Commessa -</option>
            {(db.commesse||[]).map(c=>(<option key={c.id} value={c.id}>{c.code} - {c.cantiere||'-'}</option>))}
          </select>
        </div>
        <div className="grid3" style={{marginTop:8}}>
          <select value={form.posizione_id} onChange={e=>setForm({...form, posizione_id:e.target.value})} disabled={!form.commessa_id}>
            <option value="">- Posizione -</option>
            {pos.map(p=>(<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
          <input placeholder="Cantiere" value={form.cantiere} onChange={e=>setForm({...form, cantiere:e.target.value})} disabled={(db.commesse||[]).find(c=>c.id===form.commessa_id)?.cantiere_binded}/>
          <input placeholder="Descrizione attività" value={form.descrizione} onChange={e=>setForm({...form, descrizione:e.target.value})}/>
        </div>
        <div className="grid2" style={{marginTop:8}}>
          <input type="file" accept="image/*" onChange={handleFile}/>
          <button className="btn" onClick={onSubmit}><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Inserisci</button>
        </div>
      </section>



      <section className="card section" style={{marginTop:16}}>
        <h3><Icon.List style={{marginRight:6}}/> I miei rapportini (settimana corrente)</h3>
        <table className="table">
          <thead><tr><th>Data</th><th>Commessa</th><th>Posizione</th><th>Cantiere</th><th>Ore</th><th>Stato</th></tr></thead>
          <tbody>
            {mine.map(r=>(
              <tr key={r.id}>
                <td>{r.data}</td>
                <td>{(db.commesse||[]).find(c=>c.id===r.commessa_id)?.code||'-'}</td>
                <td>{(db.posizioni||[]).find(p=>p.id===r.posizione_id)?.name||'-'}</td>
                <td>{r.cantiere||'-'}</td>
                <td>{r.ore}</td>
                <td><span className="badge">{r.stato||'—'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {isManager && (
        <section className="card section" style={{marginTop:16}}>
          <h3><Icon.FileText style={{marginRight:6}}/> Ultimi Rapportini</h3>
          <ManagerRapportiniTable db={db} profiles={db.profiles||[]} refresh={refresh} />
        </section>
      )}
    </div>
  )
}

function ManagerRapportiniTable({ db, profiles, refresh }){
  const [hiddenApproved, setHiddenApproved] = useState(()=> new Set())
  const [editingRapId, setEditingRapId] = useState(null)
  const [rapDraft, setRapDraft] = useState(null)

  async function setStato(r, stato){
    const { error } = await supabase.from('rapportini').update({ stato }).eq('id', r.id)
    if (error){ alert(error.message); return }
  }
  async function deleteRap(r){
    if(!confirm('Eliminare rapportino?')) return
    try{
      await supabase.from('rapportini').delete().eq('id', r.id)
    }catch(e){ alert(e.message||String(e)) }
    refresh && refresh()
  }
  function startEditRap(r){ setEditingRapId(r.id); setRapDraft({...r}) }
  function cancelEditRap(){ setEditingRapId(null); setRapDraft(null) }
  async function saveEditRap(r){ const row={...rapDraft}; const { error } = await supabase.from('rapportini').update({ data:row.data, ore:row.ore, descrizione:row.descrizione, commessa_id:row.commessa_id||null, posizione_id:row.posizione_id||null }).eq('id', r.id); if(error) return alert(error.message); cancelEditRap(); refresh&&refresh() }

  return (
    <table className="table">
      <thead><tr><th>Data</th><th>Dipendente</th><th>Commessa</th><th>Posizione</th><th>Foto</th><th>Ore</th><th>Descrizione</th><th>Stato</th><th>Azioni</th></tr></thead>
      <tbody>
        {((db.rapportini||[])
          .filter(r=> r.stato!=='approvato' && r.stato!=='approved' && !hiddenApproved.has(r.id))
          .slice(0,50))
          .map(r=> {
          const isEdit = editingRapId===r.id
          const posOptions = (db.posizioni||[]).filter(p=> String(p.commessa_id)===String(isEdit? rapDraft?.commessa_id : r.commessa_id))
          return (
            <tr key={r.id}>
              <td>{isEdit ? (<input type="date" className="input" value={rapDraft?.data||''} onChange={e=>setRapDraft(v=>({...v, data:e.target.value}))} />) : r.data}</td>
              <td>{(profiles||[]).find(p=>p.id===r.user_id)?.full_name||'-'}</td>
              <td>{isEdit ? (
                <select className="input" value={rapDraft?.commessa_id||''} onChange={e=>setRapDraft(v=>({...v, commessa_id:e.target.value, posizione_id:''}))}>
                  <option value="">-</option>
                  {(db.commesse||[]).map(c=>(<option key={c.id} value={String(c.id)}>{c.code||c.descrizione||c.id}</option>))}
                </select>
              ) : ((db.commesse||[]).find(c=>c.id===r.commessa_id)?.code||'-')}</td>
              <td>{isEdit ? (
                <select className="input" value={rapDraft?.posizione_id||''} onChange={e=>setRapDraft(v=>({...v, posizione_id:e.target.value}))} disabled={!rapDraft?.commessa_id}>
                  <option value="">-</option>
                  {posOptions.map(p=>(<option key={p.id} value={String(p.id)}>{p.name}</option>))}
                </select>
              ) : ((db.posizioni||[]).find(p=>p.id===r.posizione_id)?.name||'-')}</td>
              <td>{r.photo_url ? <a href={r.photo_url} target="_blank" rel="noreferrer">apri</a> : '-'}</td>
              <td>{isEdit ? (<input type="number" step="0.5" className="input" value={rapDraft?.ore||''} onChange={e=>setRapDraft(v=>({...v, ore:e.target.value}))} />) : (r.ore ?? '-')}</td>
              <td>{isEdit ? (<input className="input" value={rapDraft?.descrizione||''} onChange={e=>setRapDraft(v=>({...v, descrizione:e.target.value}))} />) : (r.descrizione||'-')}</td>
              <td><span className="badge">{r.stato||'-'}</span></td>
              <td>
                {isEdit ? (
                  <>
                    <button className="btn" onClick={()=>saveEditRap(r)}>Salva</button>
                    <button className="btn secondary" style={{marginLeft:6}} onClick={cancelEditRap}>Annulla</button>
                  </>
                ) : (
                  <>
                    <button className="btn" onClick={()=>setStato(r, 'approvato')}>Approva</button>
                    <button className="btn secondary" style={{marginLeft:6}} onClick={()=>setStato(r, 'rifiutato')}>Rifiuta</button>
                    <button className="btn" style={{marginLeft:6}} onClick={()=>startEditRap(r)}>Modifica</button>
                    <button className="btn danger" style={{marginLeft:6}} onClick={()=>deleteRap(r)}>Elimina</button>
                  </>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
