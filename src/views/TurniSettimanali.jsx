import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../_integration/supabaseClient.js'
import * as Icon from '../components/Icons.jsx'

// Helpers settimana (locale)
function startOfWeekMonday(d){ const dt=new Date(d); const day=dt.getDay()||7; const monday=new Date(dt); monday.setDate(dt.getDate()-(day-1)); monday.setHours(0,0,0,0); return monday }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x }
function fmtLocalYMD(d){ const x=new Date(d); const y=x.getFullYear(); const m=String(x.getMonth()+1).padStart(2,'0'); const da=String(x.getDate()).padStart(2,'0'); return `${y}-${m}-${da}` }
function fmtUTCYMD(d){ return new Date(d).toISOString().slice(0,10) }
function fmtLocalDMY(d){ const x=new Date(d); const da=String(x.getDate()).padStart(2,'0'); const m=String(x.getMonth()+1).padStart(2,'0'); const y=x.getFullYear(); return `${da}/${m}/${y}` }
function weekdayITUpper(d){ return new Date(d).toLocaleDateString('it-IT', { weekday:'long' }).toUpperCase() }
function weekInputToMonday(weekStr){ if(!weekStr) return startOfWeekMonday(new Date()); const [yy, wwRaw='W1'] = String(weekStr).split('-W'); const year=Number(yy); const week=Number(wwRaw.replace('W',''))||1; const jan4=new Date(year,0,4); const base=startOfWeekMonday(jan4); return addDays(base,(week-1)*7) }

const SLOTS=[
  { key:'T1', label:'1° TURNO' },
  { key:'T2', label:'2° TURNO' },
  { key:'T1_0600_1400', label:'1° TURNO (06:00 - 14:00)' },
  { key:'T2_1400_2200', label:'2° TURNO (14:00 - 22:00)' },
  { key:'T3_2200_0600', label:'3° TURNO (22:00 - 06:00)' },
  { key:'GIORNALIERO', label:'GIORNALIERO' },
]

export default function TurniSettimanali({ isManager=false }){
  const [offset,setOffset]=useState(0)
  const [cantieri,setCantieri]=useState([])
  const [activeCantiere,setActiveCantiere]=useState('')
  const [values,setValues]=useState({}) // {slot:{users:[]}}
  const [profiles,setProfiles]=useState([])
  const [haveCantieriTable,setHaveCantieriTable]=useState(false)
  const [loading,setLoading]=useState(false)
  const [assignedElsewhere,setAssignedElsewhere]=useState(new Set())
  const [weekValue,setWeekValue]=useState(()=>{ const now=new Date(); const monday=startOfWeekMonday(now); const jan4=new Date(now.getFullYear(),0,4); const firstMonday=startOfWeekMonday(jan4); const diffDays=Math.round((monday-firstMonday)/(1000*60*60*24)); const isoWeek=1+Math.floor(diffDays/7); return `${monday.getFullYear()}-W${String(isoWeek).padStart(2,'0')}` })

  const { from, to } = useMemo(()=>{ const base=startOfWeekMonday(new Date()); const start = offset===0 && weekValue ? weekInputToMonday(weekValue) : addDays(base, offset*7); const end=addDays(start,6); return { from:fmtLocalYMD(start), to:fmtLocalYMD(end) } }, [offset, weekValue])

  useEffect(()=>{ (async()=>{
    try{
      const ppl=await supabase.from('profiles').select('id,full_name,email').order('full_name',{ascending:true}); if(!ppl.error) setProfiles(ppl.data||[])
      const res=await supabase.from('cantieri').select('id,name').order('name')
      if(!res.error && (res.data||[]).length){ setCantieri(res.data||[]); setHaveCantieriTable(true); if(!activeCantiere) setActiveCantiere(String(res.data[0].id)) }
      else { const alt=await supabase.from('commesse').select('cantiere'); const set=Array.from(new Set((alt.data||[]).map(x=>x.cantiere).filter(Boolean))).map((name,i)=>({id:String(i+1),name})); setCantieri(set); setHaveCantieriTable(false); if(!activeCantiere && set.length) setActiveCantiere(String(set[0].id)) }
    }catch(e){ console.error(e) }
  })() }, [])

  async function loadValues(){
    if(!activeCantiere) return; setLoading(true)
    try{
      const name=(cantieri.find(c=> String(c.id)===String(activeCantiere))||{}).name
      let { data } = await supabase.from('shift_schedules').select('payload').eq('site',name).eq('week_start',from).maybeSingle()
      // fallback legacy chiave salvata in UTC (vecchio bug)
      if (!data){ const legacy = fmtUTCYMD(weekInputToMonday(weekValue)); const alt = await supabase.from('shift_schedules').select('payload').eq('site',name).eq('week_start', legacy).maybeSingle(); if(!alt.error && alt.data) data = alt.data }
      const raw=(data?.payload)||{}
      const norm={}
      for(const s of SLOTS){ const v=raw[s.key]; if(v && typeof v==='object' && Array.isArray(v.users)) norm[s.key]={users:v.users.filter(Boolean)}; else norm[s.key]={users:[]} }
      setValues(norm)
      // Assegnazioni altrove nella stessa settimana
      const { data:others } = await supabase.from('shift_schedules').select('site,payload').eq('week_start', from).neq('site', name)
      const set=new Set()
      for(const row of (others||[])){
        const users=Object.values(row?.payload||{}).flatMap(v=> (v?.users||[]))
        for(const uid of users){ if(uid) set.add(uid) }
      }
      setAssignedElsewhere(set)
    } finally{ setLoading(false) }
  }
  useEffect(()=>{ loadValues() }, [activeCantiere, from])
  useEffect(()=>{ setValues({}); setAssignedElsewhere(new Set()) }, [activeCantiere, from])

  function addUserToSlot(slot,uid){ setValues(v=>{ const next={...v}; for(const s of SLOTS){ const k=s.key; const arr=(next[k]?.users)||[]; next[k]={users:arr.filter(x=>x!==uid)} } next[slot]={users:[...((next[slot]?.users)||[]), uid]}; return next }) }
  function removeUser(uid){ setValues(v=>{ const next={...v}; for(const s of SLOTS){ const k=s.key; next[k]={users:((next[k]?.users)||[]).filter(x=>x!==uid)} } return next }) }
  function onDragStartUser(e,uid){ e.dataTransfer.setData('text/plain', uid) }
  function onDropSlot(e,slot){ const uid=e.dataTransfer.getData('text/plain'); if(!uid) return; if(assignedElsewhere.has(uid)){ alert('Questo utente � gi� assegnato in un altro cantiere per questa settimana.'); return } addUserToSlot(slot, uid) }
  function onDragOver(e){ e.preventDefault() }

  async function save(){
    if(!activeCantiere) return; const name=(cantieri.find(c=> String(c.id)===String(activeCantiere))||{}).name
    if(!name){ alert('Seleziona un cantiere valido'); return }
    const payload={}; for(const s of SLOTS){ payload[s.key]={users:(values[s.key]?.users)||[]} }
    // unicità utente-settimana tra cantieri
    const { data:others } = await supabase.from('shift_schedules').select('site,payload').eq('week_start', from).neq('site', name)
    const here=new Set(Object.values(payload).flatMap(v=>v.users||[])); const conflicts=[]
    for(const row of (others||[])){ const users=Object.values(row?.payload||{}).flatMap(v=> (v?.users||[])); for(const uid of users){ if(here.has(uid)) conflicts.push(uid) } }
    if(conflicts.length){ alert('Conflitto: utenti gia assegnati altrove: '+Array.from(new Set(conflicts)).join(', ')); return }
    let { error } = await supabase.from('shift_schedules').upsert({ week_start: from, site: name, payload })
    if(error){ await supabase.from('shift_schedules').delete().eq('site',name).eq('week_start',from); const ins=await supabase.from('shift_schedules').insert({ week_start: from, site: name, payload }); if(ins.error){ alert(ins.error.message); return } }
    alert('Salvato')
  }

  const cantiereName=(cantieri.find(c=> String(c.id)===String(activeCantiere))||{}).name||''
  const assignedUids=useMemo(()=>{ const s=new Set(); for(const k of Object.keys(values)){ for(const uid of (values[k]?.users||[])) s.add(uid) } return s }, [values])
  const unassigned=useMemo(()=> (profiles||[]).filter(p=> !assignedUids.has(p.id) && !assignedElsewhere.has(p.id)), [profiles, assignedUids, assignedElsewhere])
  const displayName=p=> p?.full_name||p?.email||p?.id

  return (
    <div className="page">
      <style>
        {`@media print { @page { size: A4 landscape; margin: 8mm } .print-area { font-size: 12px } .print-area .badge { font-size: 12px } .print-area .card { break-inside: avoid; box-shadow:none; border:none } }`}
      </style>
      <h2><Icon.Calendar style={{marginRight:6}}/> Turni settimanali {cantiereName ? (<span className="muted" style={{marginLeft:8, fontWeight:600}}>- {cantiereName}</span>) : null}</h2>
      <div className="row no-print" style={{gap:12, alignItems:'center'}}>
        <span>Settimana:</span>
        <button className={"btn" + (offset===0?' primary':'')} onClick={()=>{ setOffset(0) }}>Questa</button>
        <button className={"btn" + (offset===1?' primary':'')} onClick={()=>{ setWeekValue(''); setOffset(1) }}>Prossima</button>
        <label style={{marginLeft:12}}>Vai a:</label>
        <input type="week" value={weekValue} onChange={e=>{ setWeekValue(e.target.value); setOffset(0) }} />
        <span style={{marginLeft:16}}>Cantiere:</span>
        <div style={{display:'flex', gap:8, flexWrap:'wrap', alignItems:'center'}}>
          {cantieri.map(c=> (
            <button key={c.id} className={'btn' + (String(activeCantiere)===String(c.id)?' primary':'')} onClick={()=>setActiveCantiere(String(c.id))}>{c.name}</button>
          ))}
        </div>
        {isManager && (
          <>
            <button className="btn secondary" style={{marginLeft:12}} onClick={async()=>{ const name=prompt('Nome nuovo cantiere:'); if(!name) return; const { data, error } = await supabase.from('cantieri').insert({ name }).select('id,name').single(); if(error){ alert(error.message); return } setCantieri(c=>[...c,data]); setActiveCantiere(String(data.id)) }}>Nuovo cantiere</button>
            {activeCantiere && (<button className="btn" style={{marginLeft:8}} onClick={async()=>{ const c=cantieri.find(x=>x.id===activeCantiere); if(!c) return; if(!confirm(`Eliminare il cantiere "${c.name}"?`)) return; const { error } = await supabase.from('cantieri').delete().eq('id', activeCantiere); if(error){ alert(error.message); return } setCantieri(list=>list.filter(x=>x.id!==activeCantiere)); setActiveCantiere((cantieri.find(x=>x.id!==activeCantiere)||{}).id||'') }}>Elimina</button>)}
          </>
        )}
        <div style={{marginLeft:'auto'}}><button className="btn" onClick={()=>window.print()}>Stampa</button></div>
      </div>

      {isManager && (
        <div className="card no-print" style={{padding:12, marginTop:12}}>
          <div style={{fontWeight:700, marginBottom:8}}>Dipendenti non assegnati</div>
          <div style={{display:'flex', flexWrap:'wrap', gap:8}}>
            {unassigned.map(p=> (<span key={p.id} className="badge" draggable onDragStart={(e)=>onDragStartUser(e,p.id)} title={displayName(p)}>{displayName(p)}</span>))}
            {!unassigned.length && <span className="muted">Tutti assegnati</span>}
          </div>
        </div>
      )}

      <div className="card section print-area" style={{marginTop:12}}>
        {cantiereName && (<div style={{textAlign:'center', fontWeight:800, marginBottom:8}}>{String(cantiereName).toUpperCase()}</div>)}
        <div className="muted" style={{fontWeight:700, background:'#fdeaa1', padding:6, textAlign:'center'}}>TURNI SETTIMANA DAL {fmtLocalDMY(from)} {weekdayITUpper(from)} AL {fmtLocalDMY(to)} {weekdayITUpper(to)}</div>

        <div className="grid" style={{gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12}}>
          {SLOTS.slice(0,2).map(s => (
            <div key={s.key} className="card" style={{padding:12}} onDrop={(e)=>onDropSlot(e,s.key)} onDragOver={onDragOver}>
              <div style={{fontWeight:700, marginBottom:8}}>{s.label}</div>
              <div style={{display:'flex', flexWrap:'wrap', gap:8, minHeight:34}}>
                {(values[s.key]?.users||[]).map(uid=>{ const p=profiles.find(x=>x.id===uid); return (
                  <span key={uid} className="badge" draggable={isManager} onDragStart={(e)=>onDragStartUser(e,uid)} title={displayName(p)||uid}>
                    {displayName(p)||uid}
                    {isManager && (<button className="btn" style={{marginLeft:6}} onClick={()=>removeUser(uid)}>×</button>)}
                  </span>
                )})}
              </div>
            </div>
          ))}
        </div>

        <div className="grid" style={{gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginTop:12}}>
          {SLOTS.slice(2,5).map(s => (
            <div key={s.key} className="card" style={{padding:12}} onDrop={(e)=>onDropSlot(e,s.key)} onDragOver={onDragOver}>
              <div style={{fontWeight:700, marginBottom:8}}>{s.label}</div>
              <div style={{display:'flex', flexWrap:'wrap', gap:8, minHeight:34}}>
                {(values[s.key]?.users||[]).map(uid=>{ const p=profiles.find(x=>x.id===uid); return (
                  <span key={uid} className="badge" draggable={isManager} onDragStart={(e)=>onDragStartUser(e,uid)} title={displayName(p)||uid}>
                    {displayName(p)||uid}
                    {isManager && (<button className="btn" style={{marginLeft:6}} onClick={()=>removeUser(uid)}>×</button>)}
                  </span>
                )})}
              </div>
            </div>
          ))}
        </div>

        <div className="card" style={{padding:12, marginTop:12}} onDrop={(e)=>onDropSlot(e,'GIORNALIERO')} onDragOver={onDragOver}>
          <div style={{fontWeight:700, marginBottom:8}}>GIORNALIERO</div>
          <div style={{display:'flex', flexWrap:'wrap', gap:8, minHeight:34}}>
            {(values['GIORNALIERO']?.users||[]).map(uid=>{ const p=profiles.find(x=>x.id===uid); return (
              <span key={uid} className="badge" draggable={isManager} onDragStart={(e)=>onDragStartUser(e,uid)} title={displayName(p)||uid}>
                {displayName(p)||uid}
                {isManager && (<button className="btn" style={{marginLeft:6}} onClick={()=>removeUser(uid)}>×</button>)}
              </span>
            )})}
          </div>
        </div>

        <div className="card" style={{padding:16, marginTop:12, textAlign:'center'}}>
          <div style={{fontSize:18, fontWeight:700}}>
            i turni potrebbero subire dei cambiamenti in base alle esigenze lavorative
          </div>
        </div>

        <div className="row no-print" style={{marginTop:12}}>
          {isManager && (<button className="btn primary" onClick={save} disabled={loading || !activeCantiere}>Salva</button>)}
        </div>
      </div>
    </div>
  )
}

