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
import TurniSettimanali from './views/TurniSettimanaliView.jsx'
import ChangePasswordModal from './components/ChangePasswordModal.jsx'

const TABS = [
  { key:'home', label:'Home', icon:<Icon.Home /> },
  { key:'attivita', label:'Attività', icon:<Icon.ClipboardCheck /> },
  { key:'rapportini', label:'Rapportini', icon:<Icon.FileText /> },
  { key:'bacheca', label:'Bacheca', icon:<Icon.Megaphone /> },
  { key:'turni_settimanali', label:'Turni Settimanali', icon:<Icon.Calendar /> },
  { key:'admin', label:'Amministrazione', manager:true, icon:<Icon.Settings /> },
  { key:'utenti', label:'Utenti', manager:true, icon:<Icon.Users /> },
  { key:'dashboard', label:'Dashboard', manager:true, icon:<Icon.BarChart /> },
  { key:'report', label:'Report', manager:true, icon:<Icon.FileText /> },
]

export default function App(){
  if (!supabaseConfigured) {
    return (
      <div style={{display:'grid',placeItems:'center',minHeight:'100vh',padding:20}}>
        <div className='card' style={{maxWidth:520}}>
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

  // Tema disabilitato

  const user = useAuth()
  const profile = useProfile(user)
  const [active,setActive]=useState('home')
  // Considera anche user.user_metadata.role per compatibilità/sync
  const isManager = (profile?.role==='manager') || (user?.user_metadata?.role==='manager')

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

  const [toasts,setToasts] = useState([])
  function pushToast(msg){ const id = Date.now()+Math.random(); setToasts(t=> [...t, { id, msg }]); setTimeout(()=> setToasts(t=> t.filter(x=>x.id!==id)), 4500) }
  const [notifications,setNotifications] = useState([])
  const [unread,setUnread] = useState(0)
  function pushNotif(n){ setNotifications(ns=> [n, ...ns].slice(0,100)); setUnread(u=>u+1); pushToast(n.message) }
  const [showNotifs,setShowNotifs] = useState(false)
  const [showChangePwd,setShowChangePwd] = useState(false)

  useEffect(()=>{
    if (!user) return
    const ch = supabase.channel('realtime')
      .on('postgres_changes', { event:'*', schema:'public', table:'cantieri' }, refresh)
      .on('postgres_changes', { event:'*', schema:'public', table:'commesse' }, refresh)
      .on('postgres_changes', { event:'*', schema:'public', table:'posizioni' }, refresh)
      .on('postgres_changes', { event:'*', schema:'public', table:'tasks' }, refresh)
      .on('postgres_changes', { event:'*', schema:'public', table:'bacheca' }, refresh)
      .on('postgres_changes', { event:'*', schema:'public', table:'rapportini' }, refresh)
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'tasks' }, (p)=>{ const n=p.new; if(n?.user_id===user?.id){ pushNotif({ type:'task', message:`Nuova attività assegnata: ${n.title||''}` }) } })
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'bacheca' }, (p)=>{ const n=p.new; pushNotif({ type:'bacheca', message:`Nuovo annuncio: ${n?.title||''}` }) })
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'rapportini' }, (p)=>{ const n=p.new; if(n?.user_id===user?.id && ['approvato','approved'].includes(String(n.stato||'').toLowerCase())){ pushNotif({ type:'rapportino', message:'Un tuo rapportino è stato approvato' }) } })
      .subscribe()
    return ()=> supabase.removeChannel(ch)
  }, [user])

  const [searchOpen,setSearchOpen] = useState(false)
  const [searchQ,setSearchQ] = useState('')
  const [searchResults,setSearchResults] = useState([])
  async function onSearch(q){ setSearchQ(q); setSearchOpen(true); if(!q || !q.trim()) { setSearchResults([]); return }
    const ilike = `%${q}%`
    const [t,b,r] = await Promise.all([
      supabase.from('tasks').select('*').ilike('title', ilike).limit(20),
      supabase.from('bacheca').select('*').or(`title.ilike.${ilike},message.ilike.${ilike}`).limit(20),
      supabase.from('rapportini').select('*').ilike('descrizione', ilike).limit(20),
    ])
    const results = []
    for(const x of (t.data||[])) results.push({ type:'task', id:x.id, text:x.title, extra:x.cantiere||'' })
    for(const x of (b.data||[])) results.push({ type:'bacheca', id:x.id, text:x.title, extra:(x.message||'').slice(0,60) })
    for(const x of (r.data||[])) results.push({ type:'rapportino', id:x.id, text:(x.descrizione||'-'), extra:new Date(x.data).toLocaleDateString() })
    setSearchResults(results)
  }

  if (!user) return <Login />

  return (
    <div>
      <Navbar tabs={TABS} active={active} onChange={setActive} onLogout={()=>supabase.auth.signOut()} isManager={isManager} onSearch={onSearch} notificationsCount={unread} onOpenNotifications={()=>setShowNotifs(v=>!v)} onOpenChangePassword={()=>setShowChangePwd(true)} />
      <div className='toast-container'>{toasts.map(t=> <div key={t.id} className='toast'>{t.msg}</div>)}</div>
      <ChangePasswordModal isOpen={showChangePwd} onClose={()=>setShowChangePwd(false)} user={user} onSuccess={msg=>pushToast(msg)} />
      {showNotifs && (
        <div className='search-overlay' onClick={()=>setShowNotifs(false)}>
          <div className='search-panel' onClick={e=>e.stopPropagation()}>
            <div style={{padding:12,fontWeight:700}}>Notifiche</div>
            {notifications.length? notifications.map((n,i)=> <div key={i} className='item'>{n.message}</div>) : <div style={{padding:12}}>Nessuna notifica</div>}
          </div>
        </div>
      )}
      {searchOpen && (
        <div className='search-overlay' onClick={()=>setSearchOpen(false)}>
          <div className='search-panel' onClick={e=>e.stopPropagation()}>
            {searchQ && <div style={{padding:12,fontWeight:700}}>Risultati per: {searchQ}</div>}
            {searchResults.map((r,i)=> (
              <div key={i} className='item' onClick={()=>{ if(r.type==='task') setActive('attivita'); else if(r.type==='bacheca') setActive('bacheca'); else if(r.type==='rapportino') setActive('rapportini'); setSearchOpen(false) }}>
                <div style={{fontWeight:600}}>{r.text}</div>
                <div className='muted'>{r.type} · {r.extra}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {active==='home' && <Home user={user} profile={profile} db={db} />}
      {active==='attivita' && <Attivita user={user} db={db} refresh={refresh} isManager={isManager} />}
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



