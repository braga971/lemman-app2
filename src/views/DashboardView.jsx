import * as Icon from '../components/Icons.jsx'

export default function DashboardView({ data, profiles }){
  const totRapportini = (data.reports||[]).length
  const oreTot = (data.reports||[]).reduce((s,r)=>s+Number(r.ore||0),0)
  const totTasksOggi = (data.tasks||[]).filter(t=>t.data===new Date().toISOString().slice(0,10)).length
  // Turni removed: no weekly shift count

  return (
    <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))'}}>
      <div className="card"><h3><Icon.FileText style={{marginRight:6}}/> Rapportini</h3><div style={{fontSize:28,fontWeight:700}}>{totRapportini}</div></div>
      <div className="card"><h3><Icon.BarChart style={{marginRight:6}}/> Ore totali</h3><div style={{fontSize:28,fontWeight:700}}>{oreTot}</div></div>
      <div className="card"><h3><Icon.CheckCircle style={{marginRight:6}}/> Attività oggi</h3><div style={{fontSize:28,fontWeight:700}}>{totTasksOggi}</div></div>
      
    </div>
  )
}
