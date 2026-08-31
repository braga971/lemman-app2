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
  const [dailyReportDate,setDailyReportDate]=useState(()=>formatDateInput(new Date()))
  const [dailyEditId,setDailyEditId]=useState(null)
  const [dailyDraft,setDailyDraft]=useState(null)
  const [extraLines,setExtraLines]=useState([])
  const [ramsDay,setRamsDay]=useState(null)
  const [ramsDayError,setRamsDayError]=useState('')
  const [ramsDayLoading,setRamsDayLoading]=useState(false)
  const sortedCommesse = useMemo(()=> sortCommesseByCantiere(db.commesse || []), [db.commesse])
  const activeCommesse = useMemo(()=> sortedCommesse.filter(c=>!c.archived_at), [sortedCommesse])
  const selectedCommessa = useMemo(
    ()=> (db.commesse||[]).find(x=>String(x.id)===String(form.commessa_id)) || null,
    [db.commesse, form.commessa_id]
  )
  const pos = useMemo(()=> (db.posizioni||[]).filter(p=>p.commessa_id===form.commessa_id), [db.posizioni, form.commessa_id])
  const weekEnd = new Date(); weekEnd.setHours(23,59,59,999)
  const weekStart = new Date(weekEnd); weekStart.setDate(weekEnd.getDate() - 6); weekStart.setHours(0,0,0,0)
  const weekStartText = formatDateInput(weekStart)
  const weekEndText = formatDateInput(weekEnd)
  const mine = myWeekRows
  const dailyTotals = useMemo(()=> buildDailyTotals(mine), [mine])
  const weekTotal = dailyTotals.reduce((sum, row)=> sum + row.hours, 0)
  const dailyReportGroups = useMemo(
    ()=> buildRapportiniByCantiere(db.rapportini||[], dailyReportDate, db),
    [db.rapportini, db.commesse, db.posizioni, db.profiles, dailyReportDate]
  )
  const dailyReportTotal = dailyReportGroups.reduce((sum, group)=>sum + group.hours, 0)
  const dailyReportCount = dailyReportGroups.reduce((sum, group)=>sum + group.rows.length, 0)
  const currentDayRows = useMemo(
    ()=> (db.rapportini || []).filter(r=> String(r.user_id)===String(forUser || user.id) && String(r.data || '').slice(0, 10) === form.data),
    [db.rapportini, forUser, user.id, form.data]
  )
  const currentDayInsertedHours = currentDayRows.reduce((sum, r)=>sum + Number(r.ore || 0), 0)
  const currentDraftHours = buildReportLines().reduce((sum, line)=>sum + Number(line.ore || 0), 0)
  const ramsWorkedHours = Number(ramsDay?.worked_hours || 0)
  const ramsRemainingHours = Math.max(0, ramsWorkedHours - currentDayInsertedHours)
  const ramsAfterDraftHours = Math.max(0, ramsRemainingHours - currentDraftHours)

  useEffect(()=>{
    setForm(f=>({ ...f, cantiere: selectedCommessa?.cantiere || '' }))
  }, [selectedCommessa])

  function emptyExtraLine(){
    return { key:`${Date.now()}-${Math.random()}`, ore:'', commessa_id:'', posizione_id:'', descrizione:'' }
  }
  function updateExtraLine(key, patch){
    setExtraLines(list=>list.map(line=>line.key===key ? { ...line, ...patch } : line))
  }
  function removeExtraLine(key){
    setExtraLines(list=>list.filter(line=>line.key!==key))
  }
  function lineCommessa(line){
    return (db.commesse||[]).find(x=>String(x.id)===String(line.commessa_id)) || null
  }
  function linePositions(commessaId){
    return (db.posizioni||[]).filter(p=>String(p.commessa_id)===String(commessaId))
  }
  function isLineStarted(line){
    return !!line.commessa_id || !!line.posizione_id || !!line.ore || !!String(line.descrizione||'').trim()
  }
  function buildReportLines(){
    const first = { ore: form.ore, commessa_id: form.commessa_id, posizione_id: form.posizione_id, descrizione: form.descrizione }
    return [first, ...extraLines.filter(isLineStarted)]
  }

  async function loadRamsDay(){
    if (!form.data || !forUser) {
      setRamsDay(null)
      return
    }
    setRamsDayLoading(true)
    setRamsDayError('')
    const { data, error } = await supabase
      .from('rams_work_days')
      .select('*')
      .eq('profile_id', forUser)
      .eq('work_date', form.data)
      .maybeSingle()
    if (error){
      setRamsDay(null)
      const msg = String(error.message || '')
      setRamsDayError(msg.includes('relation') || msg.includes('does not exist') ? '' : msg)
    } else {
      setRamsDay(data || null)
    }
    setRamsDayLoading(false)
  }

  function applyRamsRemainingHours(){
    const value = ramsRemainingHours || ramsWorkedHours
    if (!value) return
    setForm(f=>({ ...f, ore: String(Number(value.toFixed ? value.toFixed(2) : value)) }))
  }

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

  useEffect(()=>{
    loadRamsDay()
  }, [form.data, forUser])

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
    const lines = buildReportLines()
    if (!form.data){
      alert('Per inserire il rapportino devi compilare: data')
      return
    }
    for (let i=0; i<lines.length; i++){
      const line = lines[i]
      const label = lines.length > 1 ? `riga ${i + 1}: ` : ''
      const commessa = lineCommessa(line)
      const missing = []
      if (!line.ore || Number(line.ore) <= 0) missing.push('ore')
      if (!line.commessa_id) missing.push('commessa')
      if (!line.posizione_id) missing.push('posizione')
      if (!commessa?.cantiere || String(commessa.cantiere).trim()==='') missing.push('cantiere della commessa')
      if (!line.descrizione || String(line.descrizione).trim()==='') missing.push('descrizione')
      if (missing.length){
        alert('Per inserire il rapportino devi compilare ' + label + missing.join(', '))
        return
      }
    }

    const targetUserId = forUser || user.id
    const batchHours = lines.reduce((sum, line)=>sum + Number(line.ore || 0), 0)
    const newHours = batchHours
    const { data: sameDayRows, error: checkError } = await supabase
      .from('rapportini')
      .select('id,ore,posizione_id')
      .eq('user_id', targetUserId)
      .eq('data', form.data)

    if (checkError){
      alert('Non riesco a controllare i rapportini già inseriti: ' + checkError.message)
      return
    }

    const batchPositions = new Set()
    for (const line of lines){
      const posId = String(line.posizione_id || '')
      if (batchPositions.has(posId)){
        const posName = (db.posizioni||[]).find(p=> String(p.id) === posId)?.name || 'selezionata'
        alert(`Hai inserito due righe sulla stessa posizione "${posName}". Puoi fare più rapportini nello stesso giorno, ma non sulla stessa posizione.`)
        return
      }
      batchPositions.add(posId)
    }
    const duplicated = lines.find(line=>(sameDayRows || []).some(r=> String(r.posizione_id || '') === String(line.posizione_id || '')))
    if (duplicated){
      const posName = (db.posizioni||[]).find(p=> String(p.id) === String(duplicated.posizione_id))?.name || 'selezionata'
      alert(`Rapportino già presente: in data ${form.data} hai già inserito un rapportino per la posizione "${posName}". Puoi inserire più rapportini nello stesso giorno, ma non sulla stessa posizione.`)
      return
    }

    const samePositionExists = (sameDayRows || []).some(r=> String(r.posizione_id || '') === String(form.posizione_id || ''))
    if (samePositionExists){
      const posName = (db.posizioni||[]).find(p=> String(p.id) === String(form.posizione_id))?.name || 'selezionata'
      alert(`Rapportino già presente: in data ${form.data} hai già inserito un rapportino per la posizione "${posName}". Puoi inserire più rapportini nello stesso giorno, ma non sulla stessa posizione.`)
      return
    }

    const dayHours = (sameDayRows || []).reduce((sum, r)=> sum + Number(r.ore || 0), 0)
    if (ramsWorkedHours && dayHours + newHours > ramsWorkedHours + 0.01){
      alert(`Ore superiori alle timbrature RAMS del ${form.data}: RAMS calcola ${formatHours(ramsWorkedHours)} ore, hai gia ${formatHours(dayHours)} ore inserite e con questo rapportino arriveresti a ${formatHours(dayHours + newHours)} ore.`)
      return
    }
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
    const rowsToInsert = lines.map(line=>{
      const commessa = lineCommessa(line)
      return {
        user_id: targetUserId,
        data: form.data,
        ore: Number(line.ore || 0),
        commessa_id: line.commessa_id || null,
        posizione_id: line.posizione_id || null,
        cantiere: commessa?.cantiere || null,
        descrizione: line.descrizione || null,
        photo_url,
        photo_path
      }
    })
    const { error } = await supabase.from('rapportini').insert(rowsToInsert)
    if (error) alert(error.message); else {
      setForm({ data:new Date().toISOString().slice(0,10), ore:'', commessa_id:'', posizione_id:'', cantiere:'', descrizione:'', file:null })
      setExtraLines([])
      await (refresh && refresh())
      await loadMyWeekRapportini()
      await loadRamsDay()
    }
  }

  function startDailyEdit(row){
    setDailyEditId(row.id)
    setDailyDraft({ ...row })
  }
  function cancelDailyEdit(){
    setDailyEditId(null)
    setDailyDraft(null)
  }
  async function saveDailyEdit(row){
    const draft = dailyDraft || {}
    if (!draft.data || !draft.ore || Number(draft.ore) <= 0 || !draft.commessa_id || !draft.posizione_id){
      alert('Compila data, ore, commessa e posizione.')
      return
    }
    const duplicate = await findDuplicateRapportino({
      userId: row.user_id,
      date: draft.data,
      posizioneId: draft.posizione_id,
      excludeId: row.id,
    })
    if (duplicate.error) return alert('Non riesco a controllare i rapportini gia inseriti: ' + duplicate.error.message)
    if (duplicate.row){
      const posName = posizioneName(db.posizioni, draft.posizione_id)
      alert(`Rapportino gia presente: questo dipendente ha gia un rapportino per la posizione "${posName}" in data ${draft.data}.`)
      return
    }
    const commessa = (db.commesse||[]).find(c=>String(c.id)===String(draft.commessa_id))
    const { error } = await supabase.from('rapportini').update({
      data: draft.data,
      ore: Number(draft.ore || 0),
      descrizione: draft.descrizione || null,
      commessa_id: draft.commessa_id || null,
      posizione_id: draft.posizione_id || null,
      cantiere: commessa?.cantiere || null,
      stato: draft.stato || row.stato || null
    }).eq('id', row.id)
    if (error) return alert(error.message)
    cancelDailyEdit()
    refresh && refresh()
    await loadMyWeekRapportini()
  }
  async function deleteDailyRapportino(row){
    if (!confirm('Eliminare questo rapportino?')) return
    const { error } = await supabase.from('rapportini').delete().eq('id', row.id)
    if (error) return alert(error.message)
    if (dailyEditId === row.id) cancelDailyEdit()
    refresh && refresh()
    await loadMyWeekRapportini()
  }

  return (
    <div className="container" style={{paddingTop:16}}>
      <section className="card section">
        <h3><span className="icon-chip chip-report" style={{marginRight:6}}><Icon.FileText/></span> Nuovo rapportino</h3>
        <div className="summary-tile" style={{marginBottom:12}}>
          <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
            <div>
              <strong>Ore da timbrature RAMS</strong>
              <div className="muted">
                {ramsDayLoading ? 'Caricamento timbrature...' : ramsDay ? (
                  <>
                    Ingresso {formatTime(ramsDay.normalized_start_at)} - uscita {formatTime(ramsDay.normalized_end_at)}
                    {ramsDay.status !== 'ok' ? ` - ${ramsDay.status}` : ''}
                  </>
                ) : 'Nessuna timbratura RAMS collegata per questa data'}
              </div>
              {ramsDayError && <div className="muted">{ramsDayError}</div>}
            </div>
            <div className="row">
              <span className="badge">RAMS {formatHours(ramsWorkedHours)} h</span>
              <span className="badge">Inserite {formatHours(currentDayInsertedHours)} h</span>
              <span className="badge">Residue {formatHours(ramsAfterDraftHours)} h</span>
              <button className="btn secondary" onClick={applyRamsRemainingHours} disabled={!ramsRemainingHours}>Usa ore residue</button>
            </div>
          </div>
        </div>
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
          <div className="input" style={{display:'flex',alignItems:'center',minHeight:42}}>
            {selectedCommessa?.cantiere ? `Cantiere: ${selectedCommessa.cantiere}` : 'Cantiere automatico dalla commessa'}
          </div>
          <input placeholder="Descrizione attività" value={form.descrizione} onChange={e=>setForm({...form, descrizione:e.target.value})}/>
        </div>
        {extraLines.map((line, index)=>{
          const commessa = lineCommessa(line)
          const positions = linePositions(line.commessa_id)
          return (
            <div key={line.key} className="summary-tile" style={{marginTop:10}}>
              <div className="row" style={{justifyContent:'space-between', marginBottom:8}}>
                <strong>Altro rapportino {index + 2}</strong>
                <button className="btn secondary" onClick={()=>removeExtraLine(line.key)}>Rimuovi</button>
              </div>
              <div className="grid3">
                <input type="number" min="0" step="0.5" placeholder="Ore" value={line.ore} onChange={e=>updateExtraLine(line.key, { ore:e.target.value })}/>
                <select value={line.commessa_id} onChange={e=>updateExtraLine(line.key, { commessa_id:e.target.value, posizione_id:'' })}>
                  <option value="">- Commessa -</option>
                  {activeCommesse.map(c=>(<option key={c.id} value={c.id}>{c.code} - {c.cantiere||'-'}</option>))}
                </select>
                <select value={line.posizione_id} onChange={e=>updateExtraLine(line.key, { posizione_id:e.target.value })} disabled={!line.commessa_id}>
                  <option value="">- Posizione -</option>
                  {positions.map(p=>(<option key={p.id} value={p.id}>{p.name}</option>))}
                </select>
              </div>
              <div className="grid2" style={{marginTop:8}}>
                <div className="input" style={{display:'flex',alignItems:'center',minHeight:42}}>
                  {commessa?.cantiere ? `Cantiere: ${commessa.cantiere}` : 'Cantiere automatico dalla commessa'}
                </div>
                <input placeholder="Descrizione attività" value={line.descrizione} onChange={e=>updateExtraLine(line.key, { descrizione:e.target.value })}/>
              </div>
            </div>
          )
        })}
        <div style={{marginTop:8}}>
          <button className="btn secondary" onClick={()=>setExtraLines(list=>[...list, emptyExtraLine()])}>
            <Icon.Plus style={{marginRight:6}}/> Aggiungi altro rapportino nello stesso giorno
          </button>
        </div>
        <div className="grid2" style={{marginTop:8}}>
          <input type="file" accept="image/*" onChange={handleFile}/>
          <button className="btn" onClick={onSubmit}><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Inserisci {buildReportLines().length > 1 ? `${buildReportLines().length} rapportini` : ''}</button>
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
          <div className="row" style={{justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
            <h3 style={{margin:0}}><span className="icon-chip chip-rapportini" style={{marginRight:6}}><Icon.Calendar/></span> Rapportini del giorno per cantiere</h3>
            <input type="date" value={dailyReportDate} onChange={e=>setDailyReportDate(e.target.value)} style={{maxWidth:180}} />
          </div>
          <div className="muted" style={{marginBottom:12}}>
            {dailyReportCount ? `${dailyReportCount} rapportini - ${formatHours(dailyReportTotal)} ore totali` : 'Nessun rapportino per il giorno selezionato'}
          </div>
          {dailyReportGroups.map(group=>(
            <div key={group.cantiere} className="summary-tile" style={{marginBottom:12}}>
              <div className="row" style={{justifyContent:'space-between', marginBottom:8}}>
                <strong>{group.cantiere}</strong>
                <span className="badge">{group.rows.length} rapportini - {formatHours(group.hours)} ore</span>
              </div>
              <div className="table-responsive">
                <table className="table">
                  <thead><tr><th>Dipendente</th><th>Commessa</th><th>Posizione</th><th>Ore</th><th>Descrizione</th><th>Stato</th><th>Azioni</th></tr></thead>
                  <tbody>
                    {group.rows.map(r=>{
                      const isEdit = dailyEditId === r.id
                      const draftCommessaId = isEdit ? dailyDraft?.commessa_id : r.commessa_id
                      const posOptions = (db.posizioni||[]).filter(p=>String(p.commessa_id)===String(draftCommessaId))
                      return (
                        <tr key={r.id}>
                          <td>{profileName(db.profiles, r.user_id)}</td>
                          <td>{isEdit ? (
                            <select className="input" value={dailyDraft?.commessa_id||''} onChange={e=>setDailyDraft(v=>({...v, commessa_id:e.target.value, posizione_id:''}))}>
                              <option value="">- Commessa -</option>
                              {sortCommesseByCantiere(db.commesse||[]).map(c=>(<option key={c.id} value={String(c.id)}>{c.code} - {c.cantiere||'-'}</option>))}
                            </select>
                          ) : commessaName(db.commesse, r.commessa_id)}</td>
                          <td>{isEdit ? (
                            <select className="input" value={dailyDraft?.posizione_id||''} onChange={e=>setDailyDraft(v=>({...v, posizione_id:e.target.value}))} disabled={!dailyDraft?.commessa_id}>
                              <option value="">- Posizione -</option>
                              {posOptions.map(p=>(<option key={p.id} value={String(p.id)}>{p.name}</option>))}
                            </select>
                          ) : posizioneName(db.posizioni, r.posizione_id)}</td>
                          <td>{isEdit ? (
                            <input className="input" type="number" min="0" step="0.5" value={dailyDraft?.ore||''} onChange={e=>setDailyDraft(v=>({...v, ore:e.target.value}))} />
                          ) : (<strong>{formatHours(r.ore)}</strong>)}</td>
                          <td>{isEdit ? (
                            <input className="input" value={dailyDraft?.descrizione||''} onChange={e=>setDailyDraft(v=>({...v, descrizione:e.target.value}))} />
                          ) : (r.descrizione || '-')}</td>
                          <td>{isEdit ? (
                            <select className="input" value={dailyDraft?.stato||''} onChange={e=>setDailyDraft(v=>({...v, stato:e.target.value}))}>
                              <option value="">-</option>
                              <option value="approvato">approvato</option>
                              <option value="rifiutato">rifiutato</option>
                              <option value="in_attesa">in attesa</option>
                            </select>
                          ) : (<span className="badge">{r.stato || '-'}</span>)}</td>
                          <td>
                            {isEdit ? (
                              <>
                                <button className="btn" onClick={()=>saveDailyEdit(r)}>Salva</button>
                                <button className="btn secondary" style={{marginLeft:6}} onClick={cancelDailyEdit}>Annulla</button>
                              </>
                            ) : (
                              <>
                                <button className="btn" onClick={()=>startDailyEdit(r)}>Modifica</button>
                                <button className="btn danger" style={{marginLeft:6}} onClick={()=>deleteDailyRapportino(r)}>Elimina</button>
                              </>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </section>
      )}
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

function formatTime(value){
  if (!value) return '-'
  return new Date(value).toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' })
}

function buildRapportiniByCantiere(rows, date, db){
  const map = new Map()
  for (const r of rows || []){
    if (String(r.data || '').slice(0, 10) !== date) continue
    const commessa = (db.commesse||[]).find(c=>String(c.id)===String(r.commessa_id))
    const cantiere = r.cantiere || commessa?.cantiere || 'Senza cantiere'
    const current = map.get(cantiere) || { cantiere, rows: [], hours: 0 }
    current.rows.push(r)
    current.hours += Number(r.ore || 0)
    map.set(cantiere, current)
  }
  return [...map.values()]
    .map(group=>({
      ...group,
      rows: group.rows.sort((a,b)=>{
        const person = profileName(db.profiles, a.user_id).localeCompare(profileName(db.profiles, b.user_id), 'it', { numeric:true, sensitivity:'base' })
        if (person !== 0) return person
        return String(a.created_at || '').localeCompare(String(b.created_at || ''))
      })
    }))
    .sort((a,b)=>a.cantiere.localeCompare(b.cantiere, 'it', { numeric:true, sensitivity:'base' }))
}

function profileName(profiles, userId){
  const p = (profiles||[]).find(x=>String(x.id)===String(userId))
  return p?.full_name || p?.email || '-'
}

function commessaName(commesse, commessaId){
  const c = (commesse||[]).find(x=>String(x.id)===String(commessaId))
  return c?.code || c?.descrizione || '-'
}

function posizioneName(posizioni, posizioneId){
  const p = (posizioni||[]).find(x=>String(x.id)===String(posizioneId))
  return p?.name || '-'
}

async function findDuplicateRapportino({ userId, date, posizioneId, excludeId }){
  let query = supabase
    .from('rapportini')
    .select('id')
    .eq('user_id', userId)
    .eq('data', date)
    .eq('posizione_id', posizioneId)
    .limit(1)

  if (excludeId) query = query.neq('id', excludeId)

  const { data, error } = await query
  return { row: (data || [])[0] || null, error }
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
  async function saveEditRap(r){
    const row={...rapDraft}
    if (!row.data || !row.ore || Number(row.ore) <= 0 || !row.commessa_id || !row.posizione_id){
      alert('Compila data, ore, commessa e posizione.')
      return
    }
    const duplicate = await findDuplicateRapportino({
      userId: r.user_id,
      date: row.data,
      posizioneId: row.posizione_id,
      excludeId: r.id,
    })
    if (duplicate.error) return alert('Non riesco a controllare i rapportini gia inseriti: ' + duplicate.error.message)
    if (duplicate.row){
      const posName = posizioneName(db.posizioni, row.posizione_id)
      alert(`Rapportino gia presente: questo dipendente ha gia un rapportino per la posizione "${posName}" in data ${row.data}.`)
      return
    }
    const commessa = (db.commesse||[]).find(c=> String(c.id)===String(row.commessa_id))
    const { error } = await supabase.from('rapportini').update({
      data:row.data,
      ore:row.ore,
      descrizione:row.descrizione,
      commessa_id:row.commessa_id||null,
      posizione_id:row.posizione_id||null,
      cantiere: commessa?.cantiere || null
    }).eq('id', r.id)
    if(error) return alert(error.message)
    cancelEditRap(); refresh&&refresh()
  }

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
