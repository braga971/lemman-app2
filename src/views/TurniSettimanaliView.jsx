import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../_integration/supabaseClient.js'
import { useAuth } from '../_integration/hooks.js'
import * as Icon from '../components/Icons.jsx'

// Week helpers (local timezone)
function startOfWeekMonday(d){ const dt=new Date(d); const day=dt.getDay()||7; const monday=new Date(dt); monday.setDate(dt.getDate()-(day-1)); monday.setHours(0,0,0,0); return monday }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x }
function fmtYMD(d){ const x=new Date(d); const y=x.getFullYear(); const m=String(x.getMonth()+1).padStart(2,'0'); const da=String(x.getDate()).padStart(2,'0'); return `${y}-${m}-${da}` }
function fmtDMY(d){ const x=new Date(d); const da=String(x.getDate()).padStart(2,'0'); const m=String(x.getMonth()+1).padStart(2,'0'); const y=x.getFullYear(); return `${da}/${m}/${y}` }
function weekdayITUpper(d){ return new Date(d).toLocaleDateString('it-IT',{weekday:'long'}).toUpperCase() }
function weekInputToMonday(weekStr){ if(!weekStr) return startOfWeekMonday(new Date()); const [yy, wwRaw='W1']=String(weekStr).split('-W'); const year=Number(yy); const week=Number(wwRaw.replace('W',''))||1; const jan4=new Date(year,0,4); const base=startOfWeekMonday(jan4); return addDays(base,(week-1)*7) }
function weekValueFromDate(date){ const monday=startOfWeekMonday(date); const jan4=new Date(monday.getFullYear(),0,4); const firstMonday=startOfWeekMonday(jan4); const diffDays=Math.round((monday-firstMonday)/(1000*60*60*24)); const isoWeek=1+Math.floor(diffDays/7); return `${monday.getFullYear()}-W${String(isoWeek).padStart(2,'0')}` }

const SLOTS=[
  { key:'T1', label:'1° TURNO' },
  { key:'T2', label:'2° TURNO' },
  { key:'T1_0600_1400', label:'1° TURNO (06:00 - 14:00)' },
  { key:'T2_1400_2200', label:'2° TURNO (14:00 - 22:00)' },
  { key:'T3_2200_0600', label:'3° TURNO (22:00 - 06:00)' },
  { key:'GIORNALIERO', label:'GIORNALIERO' },
]

export default function TurniSettimanaliView({ isManager=false }){
  const user = useAuth()
  const [offset,setOffset]=useState(0)
  const [cantieri,setCantieri]=useState([])
  const [activeCantiere,setActiveCantiere]=useState('')
  const [values,setValues]=useState({})
  const [profiles,setProfiles]=useState([])
  const [loading,setLoading]=useState(false)
  const [assignedElsewhere,setAssignedElsewhere]=useState(new Set())
  const [weekValue,setWeekValue]=useState(()=>{ const now=new Date(); const monday=startOfWeekMonday(now); const jan4=new Date(now.getFullYear(),0,4); const firstMonday=startOfWeekMonday(jan4); const diffDays=Math.round((monday-firstMonday)/(1000*60*60*24)); const isoWeek=1+Math.floor(diffDays/7); return `${monday.getFullYear()}-W${String(isoWeek).padStart(2,'0')}` })

  const { from, to } = useMemo(()=>{ const base=startOfWeekMonday(new Date()); const start = offset===0 && weekValue ? weekInputToMonday(weekValue) : addDays(base, offset*7); const end=addDays(start,6); return { from:fmtYMD(start), to:fmtYMD(end) } }, [offset, weekValue])

  useEffect(()=>{ (async()=>{
    try{
      const ppl=await supabase.from('profiles').select('id,full_name,email').order('full_name',{ascending:true}); if(!ppl.error) setProfiles(ppl.data||[])
      const res=await supabase.from('cantieri').select('id,name').order('name')
      if(!res.error && (res.data||[]).length){ setCantieri(res.data||[]); if(!activeCantiere) setActiveCantiere(String(res.data[0].id)) }
      else { const alt=await supabase.from('commesse').select('cantiere'); const set=Array.from(new Set((alt.data||[]).map(x=>x.cantiere).filter(Boolean))).map((name,i)=>({id:String(i+1),name})); setCantieri(set); if(!activeCantiere && set.length) setActiveCantiere(String(set[0].id)) }
    }catch(e){ console.error(e) }
  })() }, [])

  async function refreshAssignments(){
    if(!activeCantiere) return; setLoading(true)
    try{
      const name=(cantieri.find(c=> String(c.id)===String(activeCantiere))||{}).name
      const { data } = await supabase.from('shift_schedules').select('payload').eq('site',name).eq('week_start',from).maybeSingle()
      const raw=(data?.payload)||{}
      const norm={}; for(const s of SLOTS){ const v=raw[s.key]; norm[s.key]={users:(v?.users||[]).filter(Boolean)} }
      setValues(norm)
      // chi e' assegnato altrove (per questa settimana)
      const { data:others } = await supabase.from('shift_schedules').select('site,payload').eq('week_start', from).neq('site', name)
      const set=new Set(); for(const row of (others||[])){ for(const uid of Object.values(row?.payload||{}).flatMap(v=>v?.users||[])){ if(uid) set.add(uid) } }
      setAssignedElsewhere(set)
    } finally{ setLoading(false) }
  }
  useEffect(()=>{ refreshAssignments() }, [activeCantiere, from])
  useEffect(()=>{ setValues({}); setAssignedElsewhere(new Set()) }, [activeCantiere, from])

  // Limita i cantieri visibili al dipendente (solo dove assegnato nella settimana)
  useEffect(()=>{ (async()=>{
    if (isManager || !user || !from || !cantieri.length) return
    const { data: sch } = await supabase.from('shift_schedules').select('site,payload').eq('week_start', from)
    const mySites = new Set()
    for (const row of (sch||[])){
      const users = Object.values(row?.payload||{}).flatMap(v=> v?.users||[])
      if (users.includes(user.id)) mySites.add(row.site)
    }
    const allowedIds = cantieri.filter(c=> mySites.has(c.name)).map(c=> String(c.id))
    // Se non assegnato, svuota la selezione
    if (!allowedIds.length){ setActiveCantiere('') }
    else if (!allowedIds.includes(String(activeCantiere))) { setActiveCantiere(allowedIds[0]) }
  })() }, [isManager, user, from, cantieri])

  function buildPayload(vals){ const payload={}; for(const s of SLOTS){ payload[s.key]={users:(vals[s.key]?.users)||[]} } return payload }
  async function save(nextVals){
    const vals = nextVals || values
    if(!activeCantiere) return; const name=(cantieri.find(c=> String(c.id)===String(activeCantiere))||{}).name
    if(!name){ alert('Seleziona un cantiere valido'); return }
    const payload = buildPayload(vals)
    // unicita' settimanale tra cantieri
    const { data:others } = await supabase.from('shift_schedules').select('site,payload').eq('week_start', from).neq('site', name)
    const here=new Set(Object.values(payload).flatMap(v=>v.users||[])); const conflicts=[]
    for(const row of (others||[])){ const users=Object.values(row?.payload||{}).flatMap(v=> (v?.users||[])); for(const uid of users){ if(here.has(uid)) conflicts.push(uid) } }
    if(conflicts.length){ alert('Conflitto: utenti gia assegnati altrove: '+Array.from(new Set(conflicts)).join(', ')); return }
    let { error } = await supabase.from('shift_schedules').upsert({ week_start: from, site: name, payload })
    if(error){ await supabase.from('shift_schedules').delete().eq('site',name).eq('week_start',from); const ins=await supabase.from('shift_schedules').insert({ week_start: from, site: name, payload }); if(ins.error){ alert(ins.error.message); return } }
  }

  function addUserToSlot(slot,uid){
    setValues(v=>{
      const next={...v};
      for(const s of SLOTS){ const k=s.key; const arr=(next[k]?.users)||[]; next[k]={users:arr.filter(x=>x!==uid)} }
      next[slot]={users:[...((next[slot]?.users)||[]), uid]}
      // auto-save
      save(next)
      return next
    })
  }
  function removeUser(uid){
    setValues(v=>{
      const next={...v}
      for(const s of SLOTS){ const k=s.key; next[k]={users:((next[k]?.users)||[]).filter(x=>x!==uid)} }
      save(next)
      return next
    })
  }
  function onDragStartUser(e,uid){ e.dataTransfer.setData('text/plain', uid) }
  function onDropSlot(e,slot){ const uid=e.dataTransfer.getData('text/plain'); if(!uid) return; if(assignedElsewhere.has(uid)){ alert('Questo utente e gia assegnato in un altro cantiere per questa settimana.'); return } addUserToSlot(slot, uid) }
  function onDragOver(e){ e.preventDefault() }

  const cantiereName=(cantieri.find(c=> String(c.id)===String(activeCantiere))||{}).name||''
  const assignedUids=useMemo(()=>{ const s=new Set(); for(const k of Object.keys(values)){ for(const uid of (values[k]?.users||[])) s.add(uid) } return s }, [values])
  const unassigned=useMemo(()=> (profiles||[]).filter(p=> !assignedUids.has(p.id) && !assignedElsewhere.has(p.id)), [profiles, assignedUids, assignedElsewhere])
  const displayName=p=> p?.full_name||p?.email||p?.id

  return (
    <div className="page">
      <style>{`
        /* Aumenta leggibilità in stampa */
        @media print {
          @page { size: A4 landscape; margin: 8mm }
          .print-area { font-size: 12px }
          .print-area .badge { font-size: 15px; padding: 6px 10px }
          .print-area .card { break-inside: avoid; box-shadow: none; border: none }
        }
      `}</style>
      <h2><Icon.Calendar style={{marginRight:6}}/> Turni settimanali {cantiereName ? (<span className="muted" style={{marginLeft:8, fontWeight:600}}>- {cantiereName}</span>) : null}</h2>
      <div className="row no-print" style={{gap:12, alignItems:'center'}}>
        <span>Settimana:</span>
        <button className={"btn" + (offset===0?' primary':'')} onClick={()=>{ const w=weekValueFromDate(new Date()); setWeekValue(w); setOffset(0) }}>Questa</button>
        <button className={"btn" + (offset===1?' primary':'')} onClick={()=>{ const w=weekValueFromDate(addDays(new Date(),7)); setWeekValue(w); setOffset(0) }}>Prossima</button>
        <label style={{marginLeft:12}}>Vai a:</label>
        <input type="week" value={weekValue} onChange={e=>{ setWeekValue(e.target.value); setOffset(0) }} />
        <span style={{marginLeft:16}}>Cantiere:</span>
        {isManager ? (
          <div style={{display:'flex', gap:8, flexWrap:'wrap', alignItems:'center'}}>
            {cantieri.map(c=> (
              <button key={c.id} className={'btn' + (String(activeCantiere)===String(c.id)?' primary':'')} onClick={()=>setActiveCantiere(String(c.id))}>{c.name}</button>
            ))}
          </div>
        ) : (
          <div style={{fontWeight:600}}>{(cantieri.find(c=> String(c.id)===String(activeCantiere))||{}).name || 'Nessun turno assegnato'}</div>
        )}
        {isManager && (
          <>
            <button className="btn secondary" style={{marginLeft:12}} onClick={async()=>{
              const name = prompt('Nome nuovo cantiere:')
              if(!name) return
              const { data, error } = await supabase.from('cantieri').insert({ name }).select('id,name').single()
              if(error){ alert(error.message); return }
              setCantieri(list=>[...list, data])
              setActiveCantiere(String(data.id))
            }}>Nuovo cantiere</button>
            {activeCantiere && (
              <button className="btn" style={{marginLeft:8}} onClick={async()=>{
                const c=cantieri.find(x=>String(x.id)===String(activeCantiere)); if(!c) return
                if(!confirm(`Eliminare il cantiere "${c.name}"?`)) return
                const { error } = await supabase.from('cantieri').delete().eq('id', activeCantiere)
                if(error){ alert(error.message); return }
                setCantieri(list=>list.filter(x=>String(x.id)!==String(activeCantiere)))
                setActiveCantiere((prev)=>{ const first=(cantieri.find(x=>String(x.id)!==String(prev))||{}).id; return first? String(first):'' })
              }}>Elimina</button>
            )}
          </>
        )}
        <div style={{marginLeft:'auto'}}><button className="btn" onClick={()=>window.print()}>Stampa</button></div>
      </div>

      {isManager && (
        <div className="card no-print" style={{padding:12, marginTop:12}}>
          <div style={{fontWeight:700, marginBottom:8}}>Dipendenti non assegnati</div>
          <div style={{display:'flex', flexWrap:'wrap', gap:8}}>
            {unassigned.map(p=> (<span key={p.id} className="badge" style={{fontSize:15}} draggable onDragStart={(e)=>onDragStartUser(e,p.id)} title={displayName(p)}>{displayName(p)}</span>))}
            {!unassigned.length && <span className="muted">Tutti assegnati</span>}
          </div>
        </div>
      )}

      <div className="card section print-area" style={{marginTop:12}}>
        {cantiereName && (<div style={{textAlign:'center', fontWeight:800, marginBottom:8}}>{String(cantiereName).toUpperCase()}</div>)}
        <div className="muted" style={{fontWeight:700, background:'#fdeaa1', padding:6, textAlign:'center'}}>TURNI SETTIMANA DAL {fmtDMY(from)} {weekdayITUpper(from)} AL {fmtDMY(to)} {weekdayITUpper(to)}</div>

        <div className="grid" style={{gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12}}>
          {SLOTS.slice(0,2).map(s => (
            <div key={s.key} className="card" style={{padding:12}} onDrop={(e)=>onDropSlot(e,s.key)} onDragOver={onDragOver}>
              <div style={{fontWeight:700, marginBottom:8}}>{s.label}</div>
              <div style={{display:'flex', flexWrap:'wrap', gap:8, minHeight:34}}>
                {(values[s.key]?.users||[]).map(uid=>{ const p=profiles.find(x=>x.id===uid); return (
                  <span key={uid} className="badge" style={{fontSize:15}} draggable={isManager} onDragStart={(e)=>onDragStartUser(e,uid)} title={displayName(p)||uid}>
                    {displayName(p)||uid}
                    {isManager && (<button className="btn" style={{marginLeft:6}} onClick={()=>removeUser(uid)}>x</button>)}
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
                  <span key={uid} className="badge" style={{fontSize:15}} draggable={isManager} onDragStart={(e)=>onDragStartUser(e,uid)} title={displayName(p)||uid}>
                    {displayName(p)||uid}
                    {isManager && (<button className="btn" style={{marginLeft:6}} onClick={()=>removeUser(uid)}>x</button>)}
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
              <span key={uid} className="badge" style={{fontSize:15}} draggable={isManager} onDragStart={(e)=>onDragStartUser(e,uid)} title={displayName(p)||uid}>
                {displayName(p)||uid}
                {isManager && (<button className="btn" style={{marginLeft:6}} onClick={()=>removeUser(uid)}>x</button>)}
              </span>
            )})}
          </div>
        </div>
      </div>
    </div>
  )
}
