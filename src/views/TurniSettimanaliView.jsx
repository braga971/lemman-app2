import { useEffect, useMemo, useRef, useState } from 'react'
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
  // Evita che un refresh asincrono sovrascriva modifiche locali appena fatte
  const loadSeqRef = useRef(0)

  const { from, to } = useMemo(()=>{ const base=startOfWeekMonday(new Date()); const start = offset===0 && weekValue ? weekInputToMonday(weekValue) : addDays(base, offset*7); const end=addDays(start,6); return { from:fmtYMD(start), to:fmtYMD(end) } }, [offset, weekValue])

  useEffect(()=>{ (async()=>{
    try{
      const ppl=await supabase.from('profiles').select('id,full_name,email,role').order('full_name',{ascending:true});
      if(!ppl.error) setProfiles((ppl.data||[]).filter(p=> (p.role||'user') !== 'archived'))
      const res=await supabase.from('cantieri').select('id,name').order('name')
      if(!res.error && (res.data||[]).length){ setCantieri(res.data||[]); if(!activeCantiere) setActiveCantiere(String(res.data[0].id)) }
      else { const alt=await supabase.from('commesse').select('cantiere'); const set=Array.from(new Set((alt.data||[]).map(x=>x.cantiere).filter(Boolean))).map((name,i)=>({id:String(i+1),name})); setCantieri(set); if(!activeCantiere && set.length) setActiveCantiere(String(set[0].id)) }
    }catch(e){ console.error(e) }
  })() }, [])

  async function refreshAssignments(){
    if(!activeCantiere) return; setLoading(true)
    const seq = ++loadSeqRef.current
    try{
      const name=(cantieri.find(c=> String(c.id)===String(activeCantiere))||{}).name
      const { data } = await supabase.from('shift_schedules').select('payload').eq('site',name).eq('week_start',from).maybeSingle()
      const raw=(data?.payload)||{}
      // Per i dipendenti: prima prova a recuperare i profili completi via Edge Function
      let currentProfiles = profiles
      if (!isManager && name){
        try{
          const resp = await supabase.functions.invoke('get-shift-profiles', { body: { site: name, week_start: from } })
          const profs = (resp?.data?.profiles)||[]
          if (Array.isArray(profs) && profs.length){ currentProfiles = profs; setProfiles(profs.filter(p=> (p.role||'user')!=='archived')) }
        }catch(_){ /* ignore */ }
      }
      const allowed = new Set((currentProfiles||[]).filter(p=> (p.role||'user')!=='archived').map(p=>p.id))
      const norm={}; for(const s of SLOTS){ const v=raw[s.key]; const arr=(v?.users||[]).filter(Boolean); norm[s.key]={users: arr.filter(u=> allowed.size? allowed.has(typeof u==='string'? u : (u?.id||'')) : true)} }
      // Applica solo se questo refresh è ancora l'ultimo richiesto
      if (seq === loadSeqRef.current) setValues(norm)

      // chi e' assegnato altrove (per questa settimana)
      const { data:others } = await supabase.from('shift_schedules').select('site,payload').eq('week_start', from).neq('site', name)
      const set=new Set(); for(const row of (others||[])){ for(const uid of Object.values(row?.payload||{}).flatMap(v=>v?.users||[])){ if(uid) set.add(uid) } }
      setAssignedElsewhere(set)
    } finally{ setLoading(false) }
  }
  useEffect(()=>{ refreshAssignments() }, [activeCantiere, from])
  useEffect(()=>{ setValues({}); setAssignedElsewhere(new Set()) }, [activeCantiere, from])

  // Limita i cantieri visibili al dipendente: solo quelli dove ÃƒÂ¨ assegnato (settimana corrente o prossima)
  useEffect(()=>{ (async()=>{
    try{
      if (isManager || !user || !from || !cantieri.length) return
      const nextFrom = fmtYMD(addDays(new Date(from), 7))
      const { data: sch } = await supabase.from('shift_schedules').select('site,payload,week_start').in('week_start', [from, nextFrom])
      const mySites = new Set()
      for (const row of (sch||[])){
        const users = Object.values(row?.payload||{}).flatMap(v=> (v?.users||[]))
        if (users.includes(user.id)) mySites.add(row.site)
      }
      const allowed = cantieri.filter(c=> mySites.has(c.name))
      if (!allowed.length){ setActiveCantiere('') }
      else if (!allowed.some(c=> String(c.id)===String(activeCantiere))) { setActiveCantiere(String(allowed[0].id)) }
      // Nota: non modifichiamo l'elenco cantieri, ci limitiamo a forzare la selezione
    }catch(_){ /* ignore */ }
  })() }, [isManager, user, from, cantieri])

  // Dipendente: consenti solo settimana corrente o prossima
  useEffect(()=>{
    if (isManager) return
    try{
      const selectedMonday = weekInputToMonday(weekValue)
      const currMonday = startOfWeekMonday(new Date())
      const diffWeeks = Math.round((selectedMonday - currMonday)/(1000*60*60*24*7))
      if (diffWeeks < 0 || diffWeeks > 1){
        setWeekValue(weekValueFromDate(new Date()))
        setOffset(0)
      }
    }catch(_){ /* ignore */ }
  }, [weekValue, isManager])

  const isUuid = (s)=> typeof s==='string' && /^[0-9a-fA-F-]{36}$/.test(s)
  const userId = (u)=> typeof u==='string' ? u : (u?.id||'')
  function buildPayload(vals){
    const payload={}
    for(const s of SLOTS){
      const raw = (vals[s.key]?.users)||[]
      const onlyIds = raw.map(userId).filter(isUuid)
      payload[s.key] = { users: onlyIds }
    }
    return payload
  }
  async function save(nextVals, changedUserIds = []){
    const vals = nextVals || values
    if(!activeCantiere) return; const name=(cantieri.find(c=> String(c.id)===String(activeCantiere))||{}).name
    if(!name){ alert('Seleziona un cantiere valido'); return }
    const payload = buildPayload(vals)
    // Recupera assegnazioni precedenti per notificare solo la PRIMA assegnazione settimanale per utente
    let beforeUsers = new Set()
    try{
      const { data: existing } = await supabase.from('shift_schedules').select('payload').eq('site', name).eq('week_start', from).maybeSingle()
      beforeUsers = new Set(Object.values(existing?.payload||{}).flatMap(v=> (v?.users||[])))
    }catch(_){ /* ignore */ }
    // unicita' settimanale tra cantieri
    const { data:others } = await supabase.from('shift_schedules').select('site,payload').eq('week_start', from).neq('site', name)
    const here=new Set(Object.values(payload).flatMap(v=>v.users||[])); const conflicts=[]
    for(const row of (others||[])){ const users=Object.values(row?.payload||{}).flatMap(v=> (v?.users||[])); for(const uid of users){ if(here.has(uid)) conflicts.push(uid) } }
    if(conflicts.length){ alert('Conflitto: utenti gia assegnati altrove: '+Array.from(new Set(conflicts)).join(', ')); return }
    const { error } = await supabase.from('shift_schedules').upsert(
      { week_start: from, site: name, payload },
      { onConflict: 'site,week_start' }
    )
    if (error){
      console.error('Errore salvataggio turni', error)
      alert('Errore durante il salvataggio dei turni: ' + (error?.message||''))
      return
    }
    // Allinea lo stato locale con il DB per evitare rollback visivi da refresh in-flight
    await refreshAssignments()
    // Notifiche disabilitate: niente invio
  }

  function addUserToSlot(slot,uid){
    setValues(v=>{
      const next={...v};
      for(const s of SLOTS){ const k=s.key; const arr=(next[k]?.users)||[]; next[k]={users:arr.filter(x=> userId(x) !== uid)} }
      const p = profiles.find(x=>x.id===uid)
      const label = displayName(p) || uid
      next[slot]={users:[...((next[slot]?.users)||[]), { id: uid, name: label } ]}
      // auto-save
      save(next, [uid])
      return next
    })
  }
  function removeUser(uid){
    setValues(v=>{
      const next={...v}
      for(const s of SLOTS){ const k=s.key; next[k]={users:((next[k]?.users)||[]).filter(x=> (typeof x==='string'? x : (x?.id||'')) !== uid)} }
      save(next, [uid])
      return next
    })
  }
  function onDragStartUser(e,uid){ e.dataTransfer.setData('text/plain', uid) }
  function onDropSlot(e,slot){ const uid=e.dataTransfer.getData('text/plain'); if(!uid) return; if(assignedElsewhere.has(uid)){ alert('Questo utente e gia assegnato in un altro cantiere per questa settimana.'); return } addUserToSlot(slot, uid) }
  function onDragOver(e){ e.preventDefault() }

  const cantiereName=(cantieri.find(c=> String(c.id)===String(activeCantiere))||{}).name||''
  const assignedUids=useMemo(()=>{ const s=new Set(); for(const k of Object.keys(values)){ for(const u of (values[k]?.users||[])) s.add(userId(u)) } return s }, [values])
  const unassigned=useMemo(()=> (profiles||[]).filter(p=> !assignedUids.has(p.id) && !assignedElsewhere.has(p.id)), [profiles, assignedUids, assignedElsewhere])
  const displayName=p=> p?.full_name||p?.email||p?.id
  // Helpers to support both string userId and object { id, name }
  function userLabel(u){
    if (typeof u === 'object' && u && u.name) return u.name
    const uid = userId(u)
    const p = profiles.find(x=>x.id===uid)
    return displayName(p) || uid
  }

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
        {isManager && (<>
          <label style={{marginLeft:12}}>Vai a:</label>
          <input type="week" value={weekValue} onChange={e=>{ setWeekValue(e.target.value); setOffset(0) }} />
        </>)}
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
            <div key={s.key} className="card" style={{padding:12}} onDrop={isManager? (e)=>onDropSlot(e,s.key) : undefined} onDragOver={isManager? onDragOver : undefined}>
              <div style={{fontWeight:700, marginBottom:8}}>{s.label}</div>
              <div style={{display:'flex', flexWrap:'wrap', gap:8, minHeight:34}}>
                {(values[s.key]?.users||[]).map(u=>{ const uid=userId(u); return (
                  <span key={uid} className="badge" style={{fontSize:15}} draggable={isManager} onDragStart={(e)=>onDragStartUser(e,uid)} title={userLabel(u)}>
                    {userLabel(u)}
                    {isManager && (<button className="btn" style={{marginLeft:6}} onClick={()=>removeUser(uid)}>x</button>)}
                  </span>
                )})}
              </div>
            </div>
          ))}
        </div>

        <div className="grid" style={{gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginTop:12}}>
          {SLOTS.slice(2,5).map(s => (
            <div key={s.key} className="card" style={{padding:12}} onDrop={isManager? (e)=>onDropSlot(e,s.key) : undefined} onDragOver={isManager? onDragOver : undefined}>
              <div style={{fontWeight:700, marginBottom:8}}>{s.label}</div>
              <div style={{display:'flex', flexWrap:'wrap', gap:8, minHeight:34}}>
                {(values[s.key]?.users||[]).map(u=>{ const uid=userId(u); return (
                  <span key={uid} className="badge" style={{fontSize:15}} draggable={isManager} onDragStart={(e)=>onDragStartUser(e,uid)} title={userLabel(u)}>
                    {userLabel(u)}
                    {isManager && (<button className="btn" style={{marginLeft:6}} onClick={()=>removeUser(uid)}>x</button>)}
                  </span>
                )})}
              </div>
            </div>
          ))}
        </div>

        <div className="card" style={{padding:12, marginTop:12}} onDrop={isManager? (e)=>onDropSlot(e,'GIORNALIERO') : undefined} onDragOver={isManager? onDragOver : undefined}>
          <div style={{fontWeight:700, marginBottom:8}}>GIORNALIERO</div>
          <div style={{display:'flex', flexWrap:'wrap', gap:8, minHeight:34}}>
            {(values['GIORNALIERO']?.users||[]).map(u=>{ const uid=userId(u); return (
              <span key={uid} className="badge" style={{fontSize:15}} draggable={isManager} onDragStart={(e)=>onDragStartUser(e,uid)} title={userLabel(u)}>
                {userLabel(u)}
                {isManager && (<button className="btn" style={{marginLeft:6}} onClick={()=>removeUser(uid)}>x</button>)}
              </span>
            )})}
          </div>
        </div>
      </div>
    </div>
  )
}






