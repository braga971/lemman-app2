
import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../_integration/supabaseClient.js'
import * as Icon from '../components/Icons.jsx'

export default function Report(){
  const [commesse, setCommesse] = useState([])
  const [posizioni, setPosizioni] = useState([])
  const [profiles, setProfiles] = useState([])
  const [commessaId, setCommessaId] = useState('')
  const [posizione, setPosizione] = useState('') // posizione_id
  const [rows, setRows] = useState([])
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  // Load master data
  useEffect(()=>{
    (async ()=>{
      const { data: c } = await supabase.from('commesse').select('id,code,descrizione,cantiere')
      setCommesse(c||[])
      const { data: p } = await supabase.from('posizioni').select('id,commessa_id,name,valore')
      setPosizioni(p||[])
      const { data: prof } = await supabase.from('profiles').select('id,full_name,email')
      setProfiles(prof||[])
    })()
  }, [])

  // Query rapportini solo quando c'è almeno un filtro
  useEffect(()=>{
    (async ()=>{
      const hasFilters = Boolean(fromDate || toDate || commessaId || posizione)
      if (!hasFilters){ setRows([]); return }
      let q = supabase
        .from('rapportini')
        .select('id,user_id,data,ore,descrizione,commessa_id,posizione_id,cantiere')
        .order('data', { ascending: true })
      if (fromDate) q = q.gte('data', fromDate)
      if (toDate)   q = q.lte('data', toDate)
      if (commessaId) q = q.eq('commessa_id', commessaId)
      if (commessaId && posizione) q = q.eq('posizione_id', posizione)
      const { data: rr, error } = await q
      if (!error) setRows(rr||[]); else setRows([])
    })()
  }, [commessaId, posizione, fromDate, toDate])

  const posOptions = useMemo(
    ()=>posizioni.filter(p=>String(p.commessa_id)===String(commessaId)),
    [posizioni, commessaId]
  )

  function nameOf(uid){
    const p = profiles.find(x=>x.id===uid)
    return p?.full_name || p?.email || uid
  }
  function commName(cid){
    const c = commesse.find(x=>String(x.id)===String(cid))
    return c?.code || c?.descrizione || cid
  }
  function posName(pid){
    const p = posizioni.find(x=>String(x.id)===String(pid))
    return p?.name || pid
  }

  const totOre = useMemo(()=>rows.reduce((s,r)=>s+Number(r.ore||0),0), [rows])

  const orePerCantiere = useMemo(()=>{
    const m = {}
    for (const r of rows){ const k = r.cantiere || '(Senza cantiere)'; m[k] = (m[k]||0) + Number(r.ore||0) }
    return Object.entries(m).sort((a,b)=>b[1]-a[1])
  }, [rows])

  function exportCSV(){
    const header = ['Data','Dipendente','Commessa','Posizione','Cantiere','Ore','Descrizione']
    const lines = [header.join(';')]
    for (const r of rows){
      lines.push([
        new Date(r.data).toLocaleDateString(),
        JSON.stringify(nameOf(r.user_id)),
        JSON.stringify(commName(r.commessa_id)),
        JSON.stringify(posName(r.posizione_id||'')),
        JSON.stringify(r.cantiere||''),
        r.ore ?? '',
        JSON.stringify(r.descrizione||'')
      ].join(';'))
    }
    const csv = lines.join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = 'report_rapportini.csv'
    document.body.appendChild(a); a.click(); a.remove();
  }

  return (
    <div className="page">
      <h2><Icon.FileText style={{marginRight:6}}/> Report</h2>

      <div className="row" style={{gap:12, alignItems:'center'}}>
        <label>Dal:</label>
        <input className="input" type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} />
        <label>Al:</label>
        <input className="input" type="date" value={toDate} onChange={e=>setToDate(e.target.value)} />
        <label>Commessa:</label>
        <select value={commessaId} onChange={e=>setCommessaId(e.target.value)}>
          <option value="">—</option>
          {commesse.map(c=>(<option key={c.id} value={c.id}>{c.code || c.descrizione || c.id}</option>))}
        </select>

        <label>Posizione:</label>
        <select value={posizione} onChange={e=>setPosizione(e.target.value)} disabled={!commessaId}>
          <option value="">—</option>
          {posOptions.map(p=>(<option key={p.id} value={p.id}>{p.name}</option>))}
        </select>

        <button className="btn secondary" onClick={exportCSV}>Export CSV</button>
      </div>

      <div className="card">
        <h3><Icon.BarChart style={{marginRight:6}}/> Ore per cantiere</h3>
        <table className="table">
          <thead><tr><th>Cantiere</th><th>Ore</th></tr></thead>
          <tbody>
            {orePerCantiere.map(([k,v])=>(<tr key={k}><td>{k}</td><td>{v}</td></tr>))}
            {!orePerCantiere.length && (<tr><td colSpan="2">Nessun dato</td></tr>)}
          </tbody>
        </table>
      </div>

      
      <div className="card">
        <h3><Icon.Users style={{marginRight:6}}/> Totali per dipendente</h3>
        <table className="table">
          <thead><tr><th>Dipendente</th><th>Ore</th></tr></thead>
          <tbody>
            {(function(){
              const m = {};
              for (const r of rows){ const u = r.user_id; m[u] = (m[u]||0) + Number(r.ore||0) }
              const arr = Object.entries(m).map(([u,h])=>[u,h]).sort((a,b)=>b[1]-a[1]);
              return arr.map(([u,h])=> (<tr key={u}><td>{nameOf(u)}</td><td>{h}</td></tr>));
            })()}
            {!rows.length && (<tr><td colSpan="2">Nessun dato</td></tr>)}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3><Icon.List style={{marginRight:6}}/> Risultati</h3>
        <table className="table" style={{marginTop:8}}>
          <thead>
            <tr><th>Data</th><th>Dipendente</th><th>Posizione</th><th>Cantiere</th><th>Ore</th><th>Descrizione</th></tr>
          </thead>
          <tbody>
            {rows.map(r=>(
              <tr key={r.id}>
                <td>{new Date(r.data).toLocaleDateString()}</td>
                <td>{nameOf(r.user_id)}</td>
                <td>{posName(r.posizione_id)}</td>
                <td>{r.cantiere||''}</td>
                <td>{r.ore}</td>
                <td>{r.descrizione}</td>
              </tr>
            ))}
            <tr>
              <td colSpan="3" style={{textAlign:'right', fontWeight:600}}>Totale</td>
              <td style={{fontWeight:600}}>{totOre}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
