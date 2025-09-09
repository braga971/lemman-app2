
import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../_integration/supabaseClient.js'
import * as Icon from '../components/Icons.jsx'

export default function Dashboard(){
  const [month, setMonth] = useState(()=>{
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
  })
  const [rows, setRows]   = useState([])
  const [profiles, setProfiles] = useState([])
  const [commesse, setCommesse] = useState([])

  useEffect(()=>{
    (async ()=>{
      const [y,m] = month.split('-').map(x=>parseInt(x,10))
      const from = new Date(y, m-1, 1).toISOString().slice(0,10)
      const to   = new Date(y, m, 0).toISOString().slice(0,10)
      const { data: rr, error } = await supabase
        .from('rapportini')
        .select('id,user_id,data,ore,descrizione,commessa_id,posizione_id,cantiere')
        .gte('data', from).lte('data', to)
      if (!error) setRows(rr||[])

      const { data: prof } = await supabase.from('profiles').select('id,full_name,email');
        setProfiles(prof||[])
        const { data: c } = await supabase.from('commesse').select('id,code,descrizione,cantiere');
        setCommesse(c||[])
    })()
  }, [month])


  const byCantiere = useMemo(()=>{
    const m = {};
    for (const r of rows){ const k = r.cantiere || '(Senza cantiere)'; m[k] = (m[k]||0) + Number(r.ore||0) }
    return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,10);
  }, [rows]);

  const byCommessa = useMemo(()=>{
    const m = {};
    for (const r of rows){ const k = r.commessa_id || '(Senza commessa)'; m[k] = (m[k]||0) + Number(r.ore||0) }
    return Object.entries(m).sort((a,b)=>b[1]-a[1]);
  }, [rows]);

  const byUser = useMemo(()=>{
    const map = {}
    for (const r of rows){
      const uid = r.user_id
      const d = r.data
      const wk = isoWeek(d)
      map[uid] ??= { hours:0, weeks:{} }
      map[uid].hours += Number(r.ore||0)
      map[uid].weeks[wk] ??= 0
      map[uid].weeks[wk] += Number(r.ore||0)
    }
    return map
  }, [rows])

  function isoWeek(dateStr){
    const d = new Date(dateStr)
    d.setHours(0,0,0,0)
    // Thursday in current week decides the year.
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
    const week1 = new Date(d.getFullYear(),0,4)
    return 1 + Math.round(((d.getTime()-week1.getTime())/86400000 - 3 + ((week1.getDay()+6)%7))/7)
  }

  function exportDashboardCSV(){
    try{
      const lines = [];
      lines.push(['Dipendente','Ore totali','Dettaglio settimane'].join(';'))
      const entries = Object.entries(byUser).sort((a,b)=> (nameOf(a[0])||'').localeCompare(nameOf(b[0])||''))
      for (const [uid, v] of entries){
        const weeks = Object.entries(v.weeks).sort((a,b)=>Number(a[0])-Number(b[0])).map(([w,h])=>`W${w}:${h}`).join(' ')
        lines.push([JSON.stringify(nameOf(uid)), v.hours, JSON.stringify(weeks)].join(';'))
      }
      const csv = lines.join('\n')
      const a = document.createElement('a')
      a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
      a.download = 'dashboard_riepilogo.csv'
      document.body.appendChild(a); a.click(); a.remove();
    }catch(err){
      console.error('exportDashboardCSV', err)
      alert('Errore durante export CSV')
    }
  }

  function commName(cid){ const c = commesse.find(x=>String(x.id)===String(cid)); return c?.code || c?.descrizione || cid }

  function nameOf(uid){
    const p = profiles.find(x=>x.id===uid)
    return p?.full_name || p?.email || uid
  }


  const totalHours = useMemo(()=> rows.reduce((s,r)=>s+Number(r.ore||0),0), [rows]);
  const activeUsers = useMemo(()=> new Set(rows.map(r=>r.user_id)).size, [rows]);
  const activeCantieri = useMemo(()=> new Set(rows.map(r=>r.cantiere||'(Senza cantiere)')).size, [rows]);
  const activeCommesse = useMemo(()=> new Set(rows.map(r=>r.commessa_id)).size, [rows]);
  const avgPerUser = useMemo(()=> activeUsers ? Math.round((totalHours/activeUsers)*100)/100 : 0, [totalHours, activeUsers]);
  const avgPerCantiere = useMemo(()=> activeCantieri ? Math.round((totalHours/activeCantieri)*100)/100 : 0, [totalHours, activeCantieri]);

  return (
    <div className="page">
      <h2><Icon.BarChart style={{marginRight:6}}/> Dashboard</h2>
      <div className="row" style={{gap:12, alignItems:'center'}}>
        <label>Mese:</label>
        <input type="month" value={month} onChange={e=>setMonth(e.target.value)} />
      <button className="btn secondary" onClick={exportDashboardCSV}>Esporta CSV</button></div>
      <section className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:12, marginTop:12}}>
        <div className="card"><h3><Icon.List style={{marginRight:6}}/> Totale ore mese</h3><div style={{fontSize:28,fontWeight:700}}>{totalHours}</div></div>
        <div className="card"><h3><Icon.Users style={{marginRight:6}}/> Ore medie / dipendente</h3><div style={{fontSize:28,fontWeight:700}}>{avgPerUser}</div></div>
        <div className="card"><h3><Icon.Calendar style={{marginRight:6}}/> Ore medie / cantiere</h3><div style={{fontSize:28,fontWeight:700}}>{avgPerCantiere}</div></div>
        <div className="card"><h3><Icon.FileText style={{marginRight:6}}/> Commesse attive</h3><div style={{fontSize:28,fontWeight:700}}>{activeCommesse}</div></div>
      </section>


      <section className="card section" style={{marginTop:16}}>
        <h3><Icon.Users style={{marginRight:6}}/> Ore del mese per dipendente</h3>
        <table className="table">
          <thead>
            <tr><th>Dipendente</th><th>Totale ore mese</th><th>Dettaglio settimanale</th></tr>
          </thead>
          <tbody>
            {Object.entries(byUser).sort((a,b)=>nameOf(a[0]).localeCompare(nameOf(b[0]))).map(([uid, v])=>(
              <tr key={uid}>
                <td>{nameOf(uid)}</td>
                <td>{v.hours}</td>
                <td>
                  {Object.entries(v.weeks).sort((a,b)=>Number(a[0])-Number(b[0])).map(([w,h])=>(
                    <span key={w} className="badge" style={{marginRight:6}}>W{w}: {h}</span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card section" style={{marginTop:16}}>
        <h3><Icon.List style={{marginRight:6}}/> Ore del mese per cantiere (Top 10)</h3>
        <table className="table"><thead><tr><th>Cantiere</th><th>Ore</th></tr></thead><tbody>
          {byCantiere.map(([k,h])=> (<tr key={k}><td>{k}</td><td>{h}</td></tr>))}
          {!byCantiere.length && (<tr><td colSpan="2">Nessun dato</td></tr>)}
        </tbody></table>
      </section>

      <section className="card section" style={{marginTop:16}}>
        <h3><Icon.FileText style={{marginRight:6}}/> Ore del mese per commessa</h3>
        <table className="table"><thead><tr><th>Commessa</th><th>Ore</th></tr></thead><tbody>
          {byCommessa.map(([cid,h])=> (<tr key={cid}><td>{commName(cid)}</td><td>{h}</td></tr>))}
          {!byCommessa.length && (<tr><td colSpan="2">Nessun dato</td></tr>)}
        </tbody></table>
      </section>
    </div>
  )
}
