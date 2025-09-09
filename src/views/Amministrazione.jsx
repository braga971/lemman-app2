﻿import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../_integration/supabaseClient.js'
import * as Icon from '../components/Icons.jsx'

function parseStoragePublicUrl(url){
  try{
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

function AssegnaAttivitaPerCantiere({ profiles, onDone }){
  const [data, setData] = useState(new Date().toISOString().slice(0,10))
  const [cantieri, setCantieri] = useState([])
  const [cantiere, setCantiere] = useState('')
  const [fallbackCantieri, setFallbackCantieri] = useState(false)
  const SHIFTS = ['1° TURNO','2° TURNO','3° TURNO']
  const [rowsByShift, setRowsByShift] = useState(()=> ({
    '1° TURNO': Array.from({length:6}, ()=>({ user_id:'', title:'', file:null, task_id:null })),
    '2° TURNO': Array.from({length:6}, ()=>({ user_id:'', title:'', file:null, task_id:null })),
    '3° TURNO': Array.from({length:6}, ()=>({ user_id:'', title:'', file:null, task_id:null })),
  }))
  const [saving, setSaving] = useState(false)

  useEffect(()=>{ (async ()=>{
    try{
      const res = await supabase.from('cantieri').select('id,name').order('name')
      if (!res.error && (res.data||[]).length){
        setCantieri(res.data||[])
        if (!cantiere) setCantiere(String(res.data[0].id))
        setFallbackCantieri(false)
      } else {
        const alt = await supabase.from('commesse').select('cantiere')
        const set = Array.from(new Set((alt.data||[]).map(x=>x.cantiere).filter(Boolean))).map((name,i)=>({ id:String(i+1), name }))
        setCantieri(set); if (!cantiere && set.length) setCantiere(String(set[0].id))
        setFallbackCantieri(true)
        console.warn('Cantieri vuoti o non accessibili: uso fallback da commesse')
      }
    }catch(e){ console.error('Caricamento cantieri', e) }
  })() }, [])

  function setRow(shift, i, patch){ setRowsByShift(v=> ({ ...v, [shift]: v[shift].map((r,idx)=> idx===i ? ({...r, ...patch}) : r) })) }
  function addRow(shift){ setRowsByShift(v=> ({ ...v, [shift]: [...v[shift], { user_id:'', title:'', file:null, task_id:null }] })) }
  function delRow(shift, i){
    const row = rowsByShift?.[shift]?.[i]
    if (row?.task_id){
      supabase.from('tasks').delete().eq('id', row.task_id).then(()=>{}).catch(()=>{})
    }
    setRowsByShift(v=> ({ ...v, [shift]: v[shift].filter((_,idx)=> idx!==i) }))
  }

  // Carica le attività già salvate per data+cantiere selezionato
  useEffect(()=>{ (async()=>{
    try{
      const cName = (cantieri.find(c=> String(c.id)===String(cantiere))||{}).name || null
      if (!cName || !data) return
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id,user_id,title,data,cantiere,created_at')
        .eq('data', data)
        .eq('cantiere', cName)
        .order('created_at', { ascending:true })
      const base = { '1° TURNO': [], '2° TURNO': [], '3° TURNO': [] }
      for (const t of (tasks||[])){
        const parts = String(t.title||'').split(' - ')
        const maybeShift = parts[0]
        const rest = parts.slice(1).join(' - ')
        const shift = SHIFTS.includes(maybeShift) ? maybeShift : '1° TURNO'
        base[shift].push({ user_id: t.user_id||'', title: rest||'', file:null, task_id: t.id })
      }
      const padded = {}
      for (const s of SHIFTS){
        const list = base[s]
        while (list.length < 6) list.push({ user_id:'', title:'', file:null, task_id:null })
        padded[s] = list
      }
      setRowsByShift(padded)
    }catch(_){ /* ignore */ }
  })() }, [data, cantiere, cantieri])

  async function saveRow(shift, i){
    try{
      const r = rowsByShift[shift][i]
      const cName = (cantieri.find(c=> String(c.id)===String(cantiere))||{}).name || null
      if (!cName){ alert('Seleziona un cantiere'); return }
      if (!r.user_id || !String(r.title||'').trim()){ alert('Seleziona dipendente e descrizione'); return }
      let photo_url = null, photo_path = null
      if (r.file){
        try{
          const ext = String(r.file.name||'jpg').split('.').pop()
          const name = `${r.user_id}/${data}/${crypto.randomUUID()}.${ext}`
          const up = await supabase.storage.from('tasks-temp').upload(name, r.file, { upsert:false })
          if (!up.error){ const { data:pub } = await supabase.storage.from('tasks-temp').getPublicUrl(name); photo_url=pub.publicUrl; photo_path=name }
        }catch(_){ /* ignore upload errors */ }
      }
      const payload = { user_id:r.user_id, data, title:`${shift} - ${String(r.title).trim()}`, stato:'todo', cantiere: cName }
      if (photo_url) Object.assign(payload, { photo_url, photo_path })
      if (r.task_id){
        const { error } = await supabase.from('tasks').update(payload).eq('id', r.task_id)
        if (error) return alert(error.message)
        setRow(shift, i, { file:null })
      } else {
        const ins = await supabase.from('tasks').insert(payload).select('id').single()
        if (ins.error) return alert(ins.error.message)
        setRow(shift, i, { task_id: ins.data.id, file:null })
      }
      onDone && onDone()
    }catch(e){ alert(String(e?.message||e)) }
  }

  async function assegna(){
    setSaving(true)
    try{
      const cName = (cantieri.find(c=> String(c.id)===String(cantiere))||{}).name || null
      if (!cName){ alert('Seleziona un cantiere'); setSaving(false); return }
      const next = { ...rowsByShift }
      for (const shift of SHIFTS){
        for (let i=0; i<next[shift].length; i++){
          const r = next[shift][i]
          if (!r.user_id || !String(r.title||'').trim()) continue
          let photo_url = null, photo_path = null
          if (r.file){
            try{
              const ext = String(r.file.name||'jpg').split('.').pop()
              const name = `${r.user_id}/${data}/${crypto.randomUUID()}.${ext}`
              const up = await supabase.storage.from('tasks-temp').upload(name, r.file, { upsert:false })
              if (!up.error){ const { data:pub } = await supabase.storage.from('tasks-temp').getPublicUrl(name); photo_url=pub.publicUrl; photo_path=name }
            }catch(_){ /* ignore upload errors */ }
          }
          const payload = { user_id:r.user_id, data, title:`${shift} - ${String(r.title).trim()}`, stato:'todo', cantiere: cName }
          if (photo_url) Object.assign(payload, { photo_url, photo_path })
          if (r.task_id){
            await supabase.from('tasks').update(payload).eq('id', r.task_id)
          } else {
            const ins = await supabase.from('tasks').insert(payload).select('id').single()
            if (!ins.error && ins.data?.id){ next[shift][i] = { ...r, task_id: ins.data.id, file:null } }
          }
        }
      }
      setRowsByShift(next)
      onDone && onDone(); alert('Attività salvate')
    }catch(e){ alert(e.message||String(e)) } finally{ setSaving(false) }
  }

  const cantiereName = (cantieri.find(c=> String(c.id)===String(cantiere))||{}).name || ''

  return (
    <div>
      <h3><Icon.ClipboardCheck style={{marginRight:6}}/> Assegna Attività</h3>
      <div className="row no-print" style={{gap:12, alignItems:'center'}}>
        <label>Data:</label>
        <input type="date" value={data} onChange={e=>setData(e.target.value)} />
        <label style={{marginLeft:12}}>Cantiere:</label>
        <select className="select" value={cantiere} onChange={e=>setCantiere(e.target.value)} style={{zIndex:1}}>
          <option value="">- Seleziona -</option>
          {cantieri.map(c=> <option key={c.id} value={String(c.id)}>{c.name}</option>)}
        </select>
        <div style={{marginLeft:'auto'}}><button className="btn" onClick={()=>window.print()}>Stampa</button></div>
      </div>
      {fallbackCantieri && (
        <div className="alert" style={{margin:'6px 0', background:'#fff7e6'}}>
          Nessun cantiere trovato o accesso negato (RLS). Uso elenco derivato dalle commesse.
        </div>
      )}
      <div className="card print-activities" style={{marginTop:8}}>
        {cantiereName && (<div style={{textAlign:'center', fontWeight:800}}>{String(cantiereName).toUpperCase()}</div>)}
        <div className="muted" style={{fontWeight:700, background:'#fdeaa1', padding:6, textAlign:'center', marginTop:6}}>Attività del {data}</div>
        {SHIFTS.map(shift => (
          <div key={shift} className="card" style={{marginTop:10}}>
            <div style={{fontWeight:700, textAlign:'center', marginBottom:6}}>{shift}</div>
            <table className="table">
              <thead><tr><th style={{width:'35%'}}>Dipendente</th><th>Attivita</th><th style={{width:120}} className="no-print m-hide">Foto</th><th className="no-print"></th></tr></thead>
              <tbody>
                {rowsByShift[shift].map((r,i)=>(
                  <tr key={i} data-blank={!r.user_id && !r.title ? '1':'0'}>
                    <td>
                      <select className="select" value={r.user_id} onChange={e=>setRow(shift,i,{ user_id:e.target.value })}>
                        <option value="">-</option>
                        {profiles.map(p=> <option key={p.id} value={p.id}>{p.full_name||p.email}</option>)}
                      </select>
                    </td>
                    <td>
                      <textarea className="input" rows={2} value={r.title} onChange={e=>setRow(shift,i,{ title:e.target.value })} placeholder="Descrizione attivita"></textarea>
                    </td>
                    <td className="no-print m-hide"><input type="file" accept="image/*" onChange={e=>setRow(shift,i,{ file:e.target.files?.[0]||null })} /></td>
                    <td className="no-print">
                      <button className="btn" onClick={()=>saveRow(shift,i)}>Salva</button>
                      <button className="btn secondary" style={{marginLeft:6}} onClick={()=>delRow(shift,i)}>{rowsByShift[shift][i]?.task_id ? 'Elimina' : 'Rimuovi'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="row no-print" style={{marginTop:6}}>
              <button className="btn" onClick={()=>addRow(shift)}>Aggiungi riga</button>
            </div>
          </div>
        ))}
        <div className="row no-print" style={{marginTop:10}}>
          <button className="btn primary" onClick={assegna} disabled={saving}>Assegna tutte</button>
        </div>
      </div>
    </div>
  )
}

function RiepilogoAttivita({ db, date }){
  const rows = useMemo(()=> (db.tasks||[]).filter(t=>t.data===date), [db.tasks, date])
  const byCant = useMemo(()=>{
    const m = {}
    for (const r of rows){ const k = r.cantiere || '(Senza cantiere)'; (m[k]??=[]).push(r) }
    return Object.entries(m)
  }, [rows])
  const nameOf = (uid)=>{
    const p = (db.profiles||[]).find(x=>x.id===uid)
    return p?.full_name || p?.email || uid
  }
  return (
    <div>
      <h3><Icon.BarChart style={{marginRight:6}}/> Riepilogo attività per cantiere</h3>
      {byCant.length===0 && (<div className="muted" style={{marginTop:8}}>Nessuna attivita per la data selezionata</div>)}
      {byCant.map(([cant,list])=> (
        <div key={cant} className="card" style={{marginTop:12}}>
          <div style={{fontWeight:700, textAlign:'center'}}>{cant}</div>
          <table className="table"><thead><tr><th style={{width:'35%'}}>Dipendente</th><th>Attivita</th></tr></thead>
            <tbody>
              {list.map(r=> (
                <tr key={r.id}><td>{nameOf(r.user_id)}</td><td>{r.title}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

export default function Amministrazione({ db, profiles, refresh }){
  const [dateRep, setDateRep] = useState(new Date().toISOString().slice(0,10))
  const [hiddenApproved, setHiddenApproved] = useState(()=> new Set())
  const [editingRapId, setEditingRapId] = useState(null)
  const [rapDraft, setRapDraft] = useState(null)
  // Commesse & Posizioni state
  const [comm, setComm] = useState({ code:'', cantiere:'', descrizione:'', cantiere_binded:true })
  const [editingComm, setEditingComm] = useState(null)
  const [commDraft, setCommDraft] = useState(null)
  const [posForm, setPosForm] = useState({ commessa_id:'', name:'' })
  const posList = useMemo(()=> (db.posizioni||[]).filter(p=> String(p.commessa_id)===String(posForm.commessa_id)), [db.posizioni, posForm.commessa_id])
  const [editingPos, setEditingPos] = useState(null)
  const [posDraft, setPosDraft] = useState(null)

  async function setStato(r, stato){
    const { error } = await supabase.from('rapportini').update({ stato }).eq('id', r.id)
    if (error){ alert(error.message); return }
    if ((stato === 'approved' || stato === 'approvato') && r?.photo_url){
      try{
        const info = parseStoragePublicUrl(r.photo_url)
        if (info){ await supabase.storage.from(info.bucket).remove([info.path]) }
        await supabase.from('rapportini').update({ photo_url: null }).eq('id', r.id)
      }catch(_){ /* ignore */ }
    }
    if (stato === 'approved' || stato === 'approvato'){
      setHiddenApproved(prev=>{ const next=new Set(prev); next.add(r.id); return next })
    }
    refresh && refresh()
  }

  function startEditRap(r){
    setEditingRapId(r.id)
    setRapDraft({
      data: r.data,
      ore: String(r.ore ?? ''),
      commessa_id: r.commessa_id || '',
      posizione_id: r.posizione_id || '',
      descrizione: r.descrizione || '',
      cantiere: r.cantiere || ''
    })
  }

  function cancelEditRap(){ setEditingRapId(null); setRapDraft(null) }

  async function saveEditRap(r){
    try{
      const patch = {
        data: rapDraft.data,
        ore: rapDraft.ore ? Number(rapDraft.ore) : null,
        commessa_id: rapDraft.commessa_id || null,
        posizione_id: rapDraft.posizione_id || null,
        descrizione: rapDraft.descrizione || null,
        cantiere: rapDraft.cantiere || null,
      }
      // auto-compila cantiere se binded alla commessa
      const comm = (db.commesse||[]).find(c=> String(c.id)===String(rapDraft.commessa_id))
      if (comm?.cantiere_binded){ patch.cantiere = comm.cantiere || null }
      const { error } = await supabase.from('rapportini').update(patch).eq('id', r.id)
      if (error) return alert(error.message)
      cancelEditRap(); refresh && refresh()
    }catch(e){ alert(e.message||String(e)) }
  }

  async function deleteRap(r){
    try{
      if(!confirm('Eliminare il rapportino selezionato?')) return
      if (r?.photo_url){
        const info = parseStoragePublicUrl(r.photo_url)
        if (info){ try{ await supabase.storage.from(info.bucket).remove([info.path]) }catch(_){} }
      }
      const { error } = await supabase.from('rapportini').delete().eq('id', r.id)
      if (error) return alert(error.message)
      refresh && refresh()
    }catch(e){ alert(e.message||String(e)) }
  }

  return (
    <div className="container" style={{paddingTop:16}}>
      <div className="grid2">
        <section className="card section">
          <h3><Icon.FileText style={{marginRight:6}}/> Commesse & Cantieri</h3>
          <div className="grid2">
            <input placeholder="Codice commessa" value={comm.code} onChange={e=>setComm({...comm, code:e.target.value})} />
            <input placeholder="Cantiere / Cliente" value={comm.cantiere} onChange={e=>setComm({...comm, cantiere:e.target.value})} />
          </div>
          <div className="row" style={{marginTop:8}}>
            <select className="select" value={comm.cantiere} onChange={e=>setComm({...comm, cantiere:e.target.value})}>
              <option value="">— Seleziona cantiere esistente —</option>
              {(db.cantieri||[]).map(c=> (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
            <span className="muted hint">oppure scrivi un nuovo nome nel campo sopra</span>
          </div>
          <textarea placeholder="Descrizione" value={comm.descrizione} onChange={e=>setComm({...comm, descrizione:e.target.value})} />
          <label style={{display:'flex',gap:8,alignItems:'center',marginTop:8}}>
            <input type="checkbox" checked={!!comm.cantiere_binded} onChange={e=>setComm({...comm, cantiere_binded:e.target.checked})} />
            <span>Vincola cantiere alla commessa (auto-compila nel rapportino)</span>
          </label>
          <div style={{marginTop:8}}>
            <button className="btn" onClick={async()=>{
              const { error } = await supabase.from('commesse').insert({ code:comm.code?.trim()||null, cantiere:comm.cantiere?.trim()||null, descrizione:comm.descrizione?.trim()||null, cantiere_binded: !!comm.cantiere_binded })
              if (error) return alert(error.message)
              setComm({ code:'', cantiere:'', descrizione:'', cantiere_binded:true }); refresh && refresh()
            }}>Crea commessa</button>
          </div>

          <table className="table" style={{marginTop:12}}>
            <thead><tr><th>Codice</th><th>Cantiere</th><th>Descrizione</th><th>Bind</th><th></th></tr></thead>
            <tbody>
              {(db.commesse||[]).map(c=>{
                const isEdit = editingComm===c.id
                return (
                  <tr key={c.id}>
                    <td>{isEdit? <input value={commDraft?.code ?? ''} onChange={e=>setCommDraft(v=>({...v, code:e.target.value}))}/> : (c.code||'-')}</td>
                    <td>{isEdit? <input value={commDraft?.cantiere ?? ''} onChange={e=>setCommDraft(v=>({...v, cantiere:e.target.value}))}/> : (c.cantiere||'-')}</td>
                    <td>{isEdit? <input value={commDraft?.descrizione ?? ''} onChange={e=>setCommDraft(v=>({...v, descrizione:e.target.value}))}/> : (c.descrizione||'-')}</td>
                    <td>{isEdit? <input type="checkbox" checked={!!(commDraft?.cantiere_binded ?? c.cantiere_binded)} onChange={e=>setCommDraft(v=>({...v, cantiere_binded:e.target.checked}))}/> : (c.cantiere_binded ? 'Si' : 'No')}</td>
                    <td style={{textAlign:'right'}}>
                      {isEdit ? (
                        <>
                          <button className="btn" onClick={async()=>{ const row={...commDraft}; const { error } = await supabase.from('commesse').update({ code:row.code, cantiere:row.cantiere, descrizione:row.descrizione, cantiere_binded: !!row.cantiere_binded }).eq('id', c.id); if(error) return alert(error.message); setEditingComm(null); setCommDraft(null); refresh&&refresh() }}>Salva</button>
                          <button className="btn" onClick={()=>{ setEditingComm(null); setCommDraft(null) }}>Annulla</button>
                        </>
                      ): (
                        <>
                          <button className="btn" onClick={()=>{ setEditingComm(c.id); setCommDraft({...c}) }}>Modifica</button>
                          <button className="btn danger" onClick={async()=>{ if(!confirm('Eliminare commessa e relative posizioni?')) return; const { error } = await supabase.from('commesse').delete().eq('id', c.id); if(error) return alert(error.message); refresh&&refresh() }}>Elimina</button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>

        <section className="card section">
          <h3><Icon.List style={{marginRight:6}}/> Posizioni di Commessa</h3>
          <select className="select" value={posForm.commessa_id} onChange={e=>setPosForm({...posForm, commessa_id:e.target.value})}>
            <option value="">- Seleziona commessa -</option>
            {(db.commesse||[]).map(c=> (<option key={c.id} value={String(c.id)}>{c.code} - {c.cantiere||'-'}</option>))}
          </select>
          <div className="grid2" style={{marginTop:8}}>
            <input placeholder="Nuova posizione" value={posForm.name} onChange={e=>setPosForm({...posForm, name:e.target.value})} />
            <button className="btn" onClick={async()=>{ if(!posForm.commessa_id || !posForm.name?.trim()) return alert('Seleziona commessa e nome'); const { error } = await supabase.from('posizioni').insert({ commessa_id: posForm.commessa_id, name: posForm.name.trim() }); if(error) return alert(error.message); setPosForm({ commessa_id: posForm.commessa_id, name:'' }); refresh&&refresh() }}>Aggiungi</button>
          </div>
          <table className="table" style={{marginTop:12}}>
            <thead><tr><th>Posizione</th><th></th></tr></thead>
            <tbody>
              {posList.map(p=>{
                const isEdit = editingPos===p.id
                return (
                  <tr key={p.id}>
                    <td>{isEdit? <input value={posDraft?.name ?? ''} onChange={e=>setPosDraft(v=>({...v, name:e.target.value}))}/> : p.name}</td>
                    <td style={{textAlign:'right'}}>
                      {isEdit ? (
                        <>
                          <button className="btn" onClick={async()=>{ const { error } = await supabase.from('posizioni').update({ name: posDraft.name }).eq('id', p.id); if(error) return alert(error.message); setEditingPos(null); setPosDraft(null); refresh&&refresh() }}>Salva</button>
                          <button className="btn" onClick={()=>{ setEditingPos(null); setPosDraft(null) }}>Annulla</button>
                        </>
                      ) : (
                        <>
                          <button className="btn" onClick={()=>{ setEditingPos(p.id); setPosDraft({...p}) }}>Modifica</button>
                          <button className="btn danger" onClick={async()=>{ if(!confirm('Eliminare posizione?')) return; const { error } = await supabase.from('posizioni').delete().eq('id', p.id); if(error) return alert(error.message); refresh&&refresh() }}>Elimina</button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      </div>
        <section className="card section print-activities">
          <AssegnaAttivitaPerCantiere profiles={profiles} onDone={refresh} />
        </section>

        <section className="card section print-riepilogo">
          <label>Data:</label> <input type="date" value={dateRep} onChange={e=>setDateRep(e.target.value)} />
          <RiepilogoAttivita db={db} date={dateRep} />
        </section>
      

      <div className="card section" style={{marginTop:16}}>
        <h3><Icon.FileText style={{marginRight:6}}/> Ultimi Rapportini</h3>
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
      </div>
    </div>
  )
}


