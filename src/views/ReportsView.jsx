import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../_integration/supabaseClient.js'
import * as Icon from '../components/Icons.jsx'
import { exportCSV } from '../_integration/utils.js'

export default function ReportsView({ data, profiles }){
  const [f,setF]=useState({ from:'', to:'', commessa_id:'', posizione_id:'', user_id:'' })
  const [rows,setRows]=useState([])
  const pos = (data.posizioni||[]).filter(p=>!f.commessa_id || p.commessa_id===f.commessa_id)

  async function search(){
    let query = supabase.from('rapportini').select('*').order('data', { ascending:false })
    if (f.from) query = query.gte('data', f.from)
    if (f.to) query = query.lte('data', f.to)
    if (f.commessa_id) query = query.eq('commessa_id', f.commessa_id)
    if (f.posizione_id) query = query.eq('posizione_id', f.posizione_id)
    if (f.user_id) query = query.eq('user_id', f.user_id)
    const { data: d } = await query
    setRows(d||[])
  }

  useEffect(()=>{ search() }, [])

  const agg = useMemo(()=>{
    // aggregate hours by user for selection
    const m = {}
    for (const r of rows){
      const key = `${r.user_id}::${r.commessa_id||''}::${r.posizione_id||''}`
      m[key] = (m[key]||0) + Number(r.ore||0)
    }
    return m
  }, [rows])

  return (
    <div className="grid">
      <div className="card">
        <div className="row">
          <input className="input" type="date" value={f.from} onChange={e=>setF(v=>({...v, from:e.target.value}))} />
          <input className="input" type="date" value={f.to} onChange={e=>setF(v=>({...v, to:e.target.value}))} />
          <select className="select" value={f.commessa_id} onChange={e=>setF(v=>({...v, commessa_id:e.target.value, posizione_id:''}))}><option value="">Commessa…</option>{data.commesse?.map(c=><option key={c.id} value={c.id}>{c.code}</option>)}</select>
          <select className="select" value={f.posizione_id} onChange={e=>setF(v=>({...v, posizione_id:e.target.value}))} disabled={!f.commessa_id}><option value="">{f.commessa_id?'Posizione…':'Seleziona commessa'}</option>{pos.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <select className="select" value={f.user_id} onChange={e=>setF(v=>({...v, user_id:e.target.value}))}><option value="">Tutti i dipendenti…</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.full_name||p.email}</option>)}</select>
          <button className="btn" onClick={search}>Cerca</button>
          <button className="btn secondary" onClick={()=>exportCSV(rows, data)}>Export CSV</button>
        </div>
      </div>
      <div className="card">
        <h3><Icon.List style={{marginRight:6}}/> Risultati</h3>
        <table className="table"><thead><tr><th>Data</th><th>Dipendente</th><th>Commessa</th><th>Posizione</th><th>Ore</th><th>Descrizione</th><th>Stato</th></tr></thead>
          <tbody>
            {rows.map(r=>(
              <tr key={r.id}>
                <td>{new Date(r.data).toLocaleDateString()}</td>
                <td>{profiles.find(p=>p.id===r.user_id)?.full_name || profiles.find(p=>p.id===r.user_id)?.email || '—'}</td>
                <td>{(data.commesse||[]).find(c=>c.id===r.commessa_id)?.code || '—'}</td>
                <td>{(data.posizioni||[]).find(p=>p.id===r.posizione_id)?.name || '—'}</td>
                <td>{r.ore}</td>
                <td>{r.descrizione||'—'}</td>
                <td>{r.stato}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h3><Icon.BarChart style={{marginRight:6}}/> Riepilogo ore (per dipendente/commessa/posizione)</h3>
        <table className="table"><thead><tr><th>Dipendente</th><th>Commessa</th><th>Posizione</th><th>Ore totali</th></tr></thead>
          <tbody>
            {Object.entries(agg).map(([k, ore])=>{
              const [uid, cid, pid] = k.split('::')
              const user = profiles.find(p=>p.id===uid)
              const comm = (data.commesse||[]).find(c=>c.id===cid)
              const pos = (data.posizioni||[]).find(p=>p.id===pid)
              return <tr key={k}><td>{user?.full_name||user?.email||'—'}</td><td>{comm?.code||'—'}</td><td>{pos?.name||'—'}</td><td>{ore}</td></tr>
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
