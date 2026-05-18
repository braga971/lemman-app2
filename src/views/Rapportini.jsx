import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../_integration/supabaseClient.js'
import * as Icon from '../components/Icons.jsx'
import imageCompression from 'browser-image-compression'
import { getSignedUrl } from '../_integration/signedUrl.js'

export default function Rapportini({ user, db, refresh, isManager=false }){
  const [form,setForm]=useState({ data:new Date().toISOString().slice(0,10), ore:'', commessa_id:'', posizione_id:'', cantiere:'', descrizione:'', file:null })
  const [forUser,setForUser]=useState(user.id)
  const [myWeekRows,setMyWeekRows]=useState([])
  const [myWeekError,setMyWeekError]=useState('')
  const [myWeekLoading,setMyWeekLoading]=useState(false)
  const sortedCommesse = useMemo(()=> sortCommesseByCantiere(db.commesse || []), [db.commesse])
  const activeCommesse = useMemo(()=> sortedCommesse.filter(c=>!c.archived_at), [sortedCommesse])
  const pos = useMemo(()=> (db.posizioni||[]).filter(p=>p.commessa_id===form.commessa_id), [db.posizioni, form.commessa_id])
  const weekEnd = new Date(); weekEnd.setHours(23,59,59,999)
  const weekStart = new Date(weekEnd); weekStart.setDate(weekEnd.getDate() - 6); weekStart.setHours(0,0,0,0)
  const weekStartText = formatDateInput(weekStart)
  const weekEndText = formatDateInput(weekEnd)
  const mine = myWeekRows
  const dailyTotals = useMemo(()=> buildDailyTotals(mine), [mine])
  const weekTotal = dailyTotals.reduce((sum, row)=> sum + row.hours, 0)

  useEffect(()=>{
    // auto-compila cantiere quando cambia commessa
    const c = (db.commesse||[]).find(x=>x.id===form.commessa_id)
    if (c && c.cantiere_binded){ setForm(f=>({ ...f, cantiere: c.cantiere || '' })) }
  }, [form.commessa_id, db.commesse])

  async function loadMyWeekRapportini(){
    setMyWeekLoading(true)
    setMyWeekError('')
    const { data, error } = await supabase
      .from('rapportini')
      .select('*')
      .eq('user_id', user.id)
      .gte('data', weekStartText)
      .lte('data', weekEndText)
      .order('data', { ascending: false })
      .order('created_at', { ascending: false })

    if (error){
      setMyWeekRows([])
      setMyWeekError(error.message)
    } else {
      setMyWeekRows(data || [])
    }
    setMyWeekLoading(false)
  }

  useEffect(()=>{
    loadMyWeekRapportini()
  }, [user.id, weekStartText, weekEndText])

  async function handleFile(e){
    const file = e.target.files?.[0] || null;
    if (!file) { setForm(f=>({...f, file:null})); return }
    if (!isImageFile(file)){
      alert('Puoi caricare solo foto o immagini.')
      e.target.value = ''
      setForm(f=>({...f, file:null}))
      return
    }
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

    const targetUserId = forUser || user.id
    const newHours = Number(form.ore || 0)
    const { data: sameDayRows, error: checkError } = await supabase
      .from('rapportini')
      .select('id,ore,posizione_id')
      .eq('user_id', targetUserId)
      .eq('data', form.data)

    if (checkError){
      alert('Non riesco a controllare i rapportini già inseriti: ' + checkError.message)
      return
    }

    const samePositionExists = (sameDayRows || []).some(r=> String(r.posizione_id || '') === String(form.posizione_id || ''))
    if (samePositionExists){
      const posName = (db.posizioni||[]).find(p=> String(p.id) === String(form.posizione_id))?.name || 'selezionata'
      alert(`Rapportino già presente: in data ${form.data} hai già inserito un rapportino per la posizione "${posName}". Puoi inserire più rapportini nello stesso giorno, ma non sulla stessa posizione.`)
      return
    }

    const dayHours = (sameDayRows || []).reduce((sum, r)=> sum + Number(r.ore || 0), 0)
    if (dayHours + newHours > 20){
      alert(`Ore giornaliere troppo alte per il ${form.data}: hai già ${formatHours(dayHours)} ore inserite. Con questo rapportino arriveresti a ${formatHours(dayHours + newHours)} ore. Il limite massimo è 20 ore.`)
      return
    }

    let photo_url = null
    let photo_path = null
    if (form.file){
      if (!isImageFile(form.file)){
        alert('Il file allegato non e una foto. Seleziona solo immagini.')
        setForm(f=>({...f, file:null}))
        return
      }
      const path = `${user.id}/${Date.now()}_${form.file.name}`
      const up = await supabase.storage.from('rapportini-foto').upload(path, form.file, { cacheControl:'3600', upsert:false, contentType: form.file.type || 'image/jpeg' })
      if (!up.error){
        const { data } = await supabase.storage.from('rapportini-foto').getPublicUrl(path)
        photo_url = data.publicUrl
        photo_path = path
      }
    }
    const { error } = await supabase.from('rapportini').insert({
      user_id: targetUserId, data: form.data, ore: newHours,
      commessa_id: form.commessa_id || null, posizione_id: form.posizione_id || null,
      cantiere: form.cantiere || null, descrizione: form.descrizione || null,
      photo_url, photo_path
    })
    if (error) alert(error.message); else {
      setForm({ data:new Date().toISOString().slice(0,10), ore:'', commessa_id:'', posizione_id:'', cantiere:'', descrizione:'', file:null })
      await (refresh && refresh())
      await loadMyWeekRapportini()
    }
  }

  return (
    <div className="container" style={{paddingTop:16}}>
      <section className="card section">
        <h3><span className="icon-chip chip-report" style={{marginRight:6}}><Icon.FileText/></span> Nuovo rapportino</h3>
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
            {activeCommesse.map(c=>(<option key={c.id} value={c.id}>{c.code} - {c.cantiere||'-'}</option>))}
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
        <h3><span className="icon-chip chip-rapportini" style={{marginRight:6}}><Icon.List/></span> I miei rapportini (ultimi 7 giorni)</h3>
        <div className="muted" style={{marginBottom:8}}>Dal {weekStartText} al {weekEndText}</div>
        {myWeekError && <div className="alert danger" style={{marginBottom:12}}>{myWeekError}</div>}
        {!myWeekLoading && dailyTotals.length > 0 && (
          <div className="table-responsive" style={{marginBottom:12}}>
            <table className="table">
              <thead><tr><th>Giorno</th><th>Rapportini</th><th>Ore totali</th></tr></thead>
              <tbody>
                {dailyTotals.map(row=>(
                  <tr key={row.date}>
                    <td>{row.date}</td>
                    <td>{row.count}</td>
                    <td><strong>{formatHours(row.hours)}</strong></td>
                  </tr>
                ))}
                <tr>
                  <td><strong>Totale ultimi 7 giorni</strong></td>
                  <td>{mine.length}</td>
                  <td><strong>{formatHours(weekTotal)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <table className="table">
          <thead><tr><th>Data</th><th>Commessa</th><th>Posizione</th><th>Cantiere</th><th>Ore</th><th>Stato</th></tr></thead>
          <tbody>
            {myWeekLoading && (
              <tr><td colSpan="6" style={{textAlign:'center', opacity:0.7}}>Caricamento...</td></tr>
            )}
            {!myWeekLoading && mine.length===0 && !myWeekError && (
              <tr><td colSpan="6" style={{textAlign:'center', opacity:0.7}}>Nessun rapportino questa settimana</td></tr>
            )}
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
          <h3><span className="icon-chip chip-rapportini" style={{marginRight:6}}><Icon.FileText/></span> Ultimi Rapportini</h3>
          <ManagerRapportiniTable db={db} profiles={db.profiles||[]} refresh={refresh} />
        </section>
      )}
    </div>
  )
}

function formatDateInput(date){
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isImageFile(file){
  if (!file) return false
  const type = String(file.type || '').toLowerCase()
  const name = String(file.name || '').toLowerCase()
  const validType = type.startsWith('image/')
  const validExt = /\.(jpg|jpeg|png|webp|gif|heic|heif|bmp|tif|tiff)$/i.test(name)
  return validType && validExt
}

function sortCommesseByCantiere(commesse){
  return [...commesse].sort((a,b)=>{
    const cantiereCompare = String(a.cantiere || '').localeCompare(String(b.cantiere || ''), 'it', { numeric:true, sensitivity:'base' })
    if (cantiereCompare !== 0) return cantiereCompare
    return String(a.code || '').localeCompare(String(b.code || ''), 'it', { numeric:true, sensitivity:'base' })
  })
}

function buildDailyTotals(rows){
  const map = new Map()
  for (const r of rows || []){
    const date = String(r.data || '').slice(0, 10)
    if (!date) continue
    const current = map.get(date) || { date, count: 0, hours: 0 }
    current.count += 1
    current.hours += Number(r.ore || 0)
    map.set(date, current)
  }
  return [...map.values()].sort((a,b)=> b.date.localeCompare(a.date))
}

function formatHours(value){
  return Number(value || 0).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function ManagerRapportiniTable({ db, profiles, refresh }){
  const [hiddenApproved, setHiddenApproved] = useState(()=> new Set())
  const [editingRapId, setEditingRapId] = useState(null)
  const [rapDraft, setRapDraft] = useState(null)
  const [signedMap, setSignedMap] = useState({})

  useEffect(()=>{
    (async()=>{
      const list = (db.rapportini||[])
        .filter(r=> r.stato!=='approvato' && r.stato!=='approved' && !!r.photo_path && !hiddenApproved.has(r.id))
        .slice(0,50)
      const entries = await Promise.all(list.map(async r=>{
        try{ const url = await getSignedUrl('rapportini-foto', r.photo_path, 3600); return [r.id, url] } catch(_){ return [r.id, null] }
      }))
      const map = {}
      for (const [id, url] of entries) map[id] = url
      setSignedMap(map)
    })()
  }, [
    (db.rapportini||[]).filter(r=> r.stato!=='approvato' && r.stato!=='approved').map(r=>`${r.id}:${r.photo_path||''}`).join('|'),
    hiddenApproved.size
  ])

  async function setStato(r, stato){
    const { error } = await supabase.from('rapportini').update({ stato }).eq('id', r.id)
    if (error){ alert(error.message); return }
    // Se approvato, nascondi subito dalla lista senza ricaricare
    if (stato === 'approvato' || stato === 'approved'){
      setHiddenApproved(prev => { const next = new Set(prev); next.add(r.id); return next })
    }
    refresh && refresh()
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
                  {sortCommesseByCantiere(db.commesse||[]).map(c=>(<option key={c.id} value={String(c.id)}>{c.cantiere ? `${c.cantiere} - ` : ''}{c.code||c.descrizione||c.id}</option>))}
                </select>
              ) : ((db.commesse||[]).find(c=>c.id===r.commessa_id)?.code||'-')}</td>
              <td>{isEdit ? (
                <select className="input" value={rapDraft?.posizione_id||''} onChange={e=>setRapDraft(v=>({...v, posizione_id:e.target.value}))} disabled={!rapDraft?.commessa_id}>
                  <option value="">-</option>
                  {posOptions.map(p=>(<option key={p.id} value={String(p.id)}>{p.name}</option>))}
                </select>
              ) : ((db.posizioni||[]).find(p=>p.id===r.posizione_id)?.name||'-')}</td>
              <td>{(r.photo_url) ? (
                <a href={r.photo_url} target="_blank" rel="noreferrer">apri</a>
              ) : (r.photo_path ? (
                <button className="btn" onClick={async()=>{
                  const pre = signedMap[r.id] || null
                  if (pre){ window.open(pre, '_blank', 'noopener') ; return }
                  const w = window.open('', '_blank', 'noopener')
                  try{
                    const url = await getSignedUrl('rapportini-foto', r.photo_path, 3600)
                    if (url && w) w.location.href = url; else try{ w && w.close() }catch(_){ /* ignore */ }
                  }catch(_e){ try{ w && w.close() }catch(__){} }
                }}>
                  apri
                </button>
              ) : '-')}</td>
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
