import { useEffect, useState } from 'react'
import Navbar from './components/Navbar.jsx'
import Login from './Login.jsx'
import { useAuth, useProfile } from './_integration/hooks.js'
import { supabase, supabaseConfigured } from './_integration/supabaseClient.js'
import * as Icon from './components/Icons.jsx'

import Home from './views/Home.jsx'
import Attivita from './views/Attivita.jsx'
import Rapportini from './views/Rapportini.jsx'
import Bacheca from './views/Bacheca.jsx'
import Amministrazione from './views/Amministrazione.jsx'
import UtentiView from './views/UtentiView.jsx'
import Dashboard from './views/Dashboard.jsx'
import Report from './views/Report.jsx'
import TurniSettimanali from './views/TurniSettimanali.jsx'

const TABS = [
  { key:"home", label:"Home", icon:<Icon.Home /> },
  { key:"attivita", label:"Attività", icon:<Icon.ClipboardCheck /> },
  { key:"rapportini", label:"Rapportini", icon:<Icon.FileText /> },
  { key:"bacheca", label:"Bacheca", icon:<Icon.Megaphone /> },
  { key:"turni_settimanali", label:"Turni Settimanali", icon:<Icon.Calendar /> },
  { key:"admin", label:"Amministrazione", manager:true, icon:<Icon.Settings /> },
  { key:"utenti", label:"Utenti", manager:true, icon:<Icon.Users /> },
  { key:"dashboard", label:"Dashboard", manager:true, icon:<Icon.BarChart /> },
  { key:"report", label:"Report", manager:true, icon:<Icon.FileText /> },
]

export default function App(){
  if (!supabaseConfigured) {
    return (
      <div style={{display:'grid',placeItems:'center',minHeight:'100vh',padding:20}}>
        <div className="card" style={{maxWidth:520}}>
          <h2>Configurazione necessaria</h2>
          <p>
            Backend Supabase non configurato. Imposta le variabili ambiente
            <code style={{marginLeft:6}}>VITE_SUPABASE_URL</code> e
            <code style={{marginLeft:6}}>VITE_SUPABASE_ANON_KEY</code> durante il build
            (GitHub Actions: repository secrets) e riesegui il deploy.
          </p>
        </div>
      </div>
    )
  }
  const user = useAuth()
  const profile = useProfile(user)
  const [active,setActive]=useState('home')
  const isManager = profile?.role==='manager'

  // Blocca accesso a profili archiviati
  useEffect(()=>{
    if (user && profile && profile.role === 'archived'){
      alert('Il tuo profilo è archiviato. Contatta un amministratore.')
      supabase.auth.signOut()
    }
  }, [user, profile])

  const [db,setDb]=useState({ cantieri:[], commesse:[], posizioni:[], tasks:[], bacheca:[], rapportini:[], profiles:[] })
  async function refresh(){
    if (!user) return
    const [S,C,P,TS,B,R,PR] = await Promise.all([
      supabase.from('cantieri').select('id,name').order('name',{ascending:true}),
      supabase.from('commesse').select('*').order('created_at',{ascending:false}),
      supabase.from('posizioni').select('*').order('created_at',{ascending:false}),
      supabase.from('tasks').select('*').order('created_at',{ascending:false}),
      supabase.from('bacheca').select('*').order('created_at',{ascending:false}),
      supabase.from('rapportini').select('*').order('created_at',{ascending:false}),
      supabase.from('profiles').select('*').order('created_at',{ascending:false}),
    ])
    setDb({
      cantieri:S.data||[], commesse:C.data||[], posizioni:P.data||[], tasks:TS.data||[], bacheca:B.data||[],
      rapportini:R.data||[], profiles:PR.data||[]
    })
  }

  useEffect(()=>{ if(user) refresh() }, [user])

  useEffect(()=>{
    if (!user) return
    const ch = supabase.channel('realtime')
      .on('postgres_changes', { event:'*', schema:'public', table:'cantieri' }, refresh)
      .on('postgres_changes', { event:'*', schema:'public', table:'commesse' }, refresh)
      .on('postgres_changes', { event:'*', schema:'public', table:'posizioni' }, refresh)
      .on('postgres_changes', { event:'*', schema:'public', table:'tasks' }, refresh)
      .on('postgres_changes', { event:'*', schema:'public', table:'bacheca' }, refresh)
      .on('postgres_changes', { event:'*', schema:'public', table:'rapportini' }, refresh)
      .subscribe()
    return ()=> supabase.removeChannel(ch)
  }, [user])

  if (!user) return <Login />

  return (
    <div>
      <Navbar tabs={TABS} active={active} onChange={setActive} onLogout={()=>supabase.auth.signOut()} isManager={isManager} />
      {active==='home' && <Home user={user} profile={profile} db={db} />}
      {active==='attivita' && <Attivita user={user} db={db} refresh={refresh} />}
      {active==='rapportini' && <Rapportini user={user} db={db} refresh={refresh} isManager={isManager} />}
      {active==='bacheca' && <Bacheca db={db} isManager={isManager} refresh={refresh} />}
      {active==='turni_settimanali' && <TurniSettimanali isManager={isManager} />}
      {active==='admin' && isManager && <Amministrazione db={db} profiles={db.profiles} refresh={refresh} />}
      {active==='utenti' && isManager && <UtentiView />}
      {active==='dashboard' && isManager && <Dashboard />}
      {active==='report' && isManager && <Report />}
    </div>
  )
}


