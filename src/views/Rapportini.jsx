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
    </div>
  )
}
