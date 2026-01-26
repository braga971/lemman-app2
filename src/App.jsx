import { useEffect, useRef, useState } from 'react'
import Navbar from './components/Navbar.jsx'
import Login from './Login.jsx'
import { useAuth, useProfile } from './_integration/hooks.js'
import { supabase, supabaseConfigured } from './_integration/supabaseClient.js'
import * as Icon from './components/Icons.jsx'
import { useQueries, useQueryClient } from '@tanstack/react-query'

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
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'

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

const routeFor = {
  home: '/',
  attivita: '/attivita',
  rapportini: '/rapportini',
  bacheca: '/bacheca',
  turni_settimanali: '/turni',
  admin: '/admin',
  utenti: '/utenti',
  dashboard: '/dashboard',
  report: '/report',
}

function keyFromPath(pathname){
  if (pathname === '/' || pathname === '') return 'home'
  const map = Object.entries(routeFor).map(([k,p])=>[k, p])
  const found = map.find(([,p])=> pathname.startsWith(p) && p !== '/')
  return found?.[0] || 'home'
}

export default function App(){
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

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

  const user = useAuth()
  const profile = useProfile(user)
  const [active,setActive]=useState(keyFromPath(location.pathname))
  // Considera anche user.user_metadata.role per compatibilità/sync
  const isManager = (profile?.role==='manager') || (user?.user_metadata?.role==='manager')

  // Blocca accesso a profili archiviati
  useEffect(()=>{
    if (user && profile && profile.role === 'archived'){
      alert('Il tuo profilo è archiviato. Contatta un amministratore.')
      supabase.auth.signOut()
    }
  }, [user, profile])

  const enabled = !!user
  const results = useQueries({
    queries: [
      { queryKey:['cantieri'], queryFn: async()=> (await supabase.from('cantieri').select('id,name').order('name', {ascending:true})).data||[], enabled },
      { queryKey:['commesse'], queryFn: async()=> (await supabase.from('commesse').select('*').order('created_at', {ascending:false})).data||[], enabled },
      { queryKey:['posizioni'], queryFn: async()=> (await supabase.from('posizioni').select('*').order('created_at', {ascending:false})).data||[], enabled },
      { queryKey:['tasks'], queryFn: async()=> (await supabase.from('tasks').select('*').order('created_at', {ascending:false})).data||[], enabled },
      { queryKey:['bacheca'], queryFn: async()=> (await supabase.from('bacheca').select('*').order('created_at', {ascending:false})).data||[], enabled },
      { queryKey:['rapportini'], queryFn: async()=> (await supabase.from('rapportini').select('*').order('created_at', {ascending:false})).data||[], enabled },
      { queryKey:['profiles'], queryFn: async()=> (await supabase.from('profiles').select('*').order('created_at', {ascending:false})).data||[], enabled },
      { queryKey:['notifications', user?.id], queryFn: async()=> (await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at',{ascending:false}).limit(100)).data||[], enabled },
    ]
  })
  const [qCantieri,qCommesse,qPosizioni,qTasks,qBacheca,qRapportini,qProfiles,qNotifications] = results
  const db = {
    cantieri: qCantieri?.data||[],
    commesse: qCommesse?.data||[],
    posizioni: qPosizioni?.data||[],
    tasks: qTasks?.data||[],
    bacheca: qBacheca?.data||[],
    rapportini: qRapportini?.data||[],
    profiles: qProfiles?.data||[],
  }
  const refresh = ()=> { try{ queryClient.invalidateQueries({ predicate: ()=> true }) } catch(_){} }

  // sync UI tab with URL
  useEffect(()=>{
    const k = keyFromPath(location.pathname)
    if (k !== active) setActive(k)
  }, [location.pathname])

  const [toasts,setToasts] = useState([])
  function pushToast(msg){ const id = Date.now()+Math.random(); setToasts(t=> [...t, { id, msg }]); setTimeout(()=> setToasts(t=> t.filter(x=>x.id!==id)), 4500) }
  const [notifications,setNotifications] = useState([])
  const [unread,setUnread] = useState(0)
  function pushNotif(n){ setNotifications(ns=> [n, ...ns].slice(0,100)); setUnread(u=>u+1); pushToast(n.message) }

  // Initialize notifications from query
  useEffect(()=>{
    if (Array.isArray(qNotifications?.data)){
      setNotifications(qNotifications.data)
      setUnread((qNotifications.data||[]).filter(n=> !n.read_at).length)
    }
  }, [qNotifications?.data])

  const [showNotifs,setShowNotifs] = useState(false)
  const notifPanelRef = useRef(null)
  const [showChangePwd,setShowChangePwd] = useState(false)

  // Realtime subscriptions -> invalidate specific queries
  useEffect(()=>{
    if (!user) return
    const ch = supabase.channel('realtime')
      .on('postgres_changes', { event:'*', schema:'public', table:'cantieri' }, ()=> queryClient.invalidateQueries({ queryKey:['cantieri'] }))
      .on('postgres_changes', { event:'*', schema:'public', table:'commesse' }, ()=> queryClient.invalidateQueries({ queryKey:['commesse'] }))
      .on('postgres_changes', { event:'*', schema:'public', table:'posizioni' }, ()=> queryClient.invalidateQueries({ queryKey:['posizioni'] }))
      .on('postgres_changes', { event:'*', schema:'public', table:'tasks' }, ()=> queryClient.invalidateQueries({ queryKey:['tasks'] }))
      .on('postgres_changes', { event:'*', schema:'public', table:'bacheca' }, ()=> queryClient.invalidateQueries({ queryKey:['bacheca'] }))
      .on('postgres_changes', { event:'*', schema:'public', table:'rapportini' }, ()=> queryClient.invalidateQueries({ queryKey:['rapportini'] }))
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'notifications' }, (payload)=>{
        const row = payload?.new
        if (row && row.user_id === user.id){ pushNotif(row); queryClient.invalidateQueries({ queryKey:['notifications', user.id] }) }
      })
      .subscribe()
    return ()=>{ try{ supabase.removeChannel(ch) }catch(_){ /* ignore */ } }
  }, [user])

  // Cancella notifiche quando l'overlay viene CHIUSO (non all'apertura)
  const prevShowNotifsRef = useRef(false)
  useEffect(()=>{
    (async()=>{
      try{
        if (user && prevShowNotifsRef.current === true && showNotifs === false){
          let ok=false
          try{
            const { data, error } = await supabase.functions.invoke('clear-notifications')
            if (!error && data?.ok) ok=true
          }catch(_){ /* ignore */ }
          if (!ok){
            const { error } = await supabase.from('notifications').delete().eq('user_id', user.id)
            if (!error) ok = true
            else console.warn('Errore cancellazione notifiche (direct):', error)
          }
          if (!ok){
            pushToast('Impossibile cancellare le notifiche. Contatta supporto.')
          } else {
            setNotifications([])
            setUnread(0)
            queryClient.invalidateQueries({ queryKey:['notifications', user.id] })
          }
        }
      }catch(err){
        console.warn('Eccezione cancellazione notifiche:', err)
        pushToast('Errore inatteso nella cancellazione notifiche')
      }
      prevShowNotifsRef.current = showNotifs
    })()
  }, [showNotifs, user])

  // Portare in primo piano e focus al pannello notifiche; blocca lo scroll del body quando aperto
  useEffect(()=>{
    if (showNotifs){
      try { document.body.style.overflow = 'hidden' } catch(_e){}
      // Ritarda al frame successivo per essere sicuri che il nodo sia montato
      setTimeout(()=>{ try { notifPanelRef.current?.focus() } catch(_e){} }, 0)
    } else {
      try { document.body.style.overflow = '' } catch(_e){}
    }
    return ()=>{ try { document.body.style.overflow = '' } catch(_e){} }
  }, [showNotifs])

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
      <Navbar
        tabs={TABS}
        active={active}
        onChange={(k)=>{ setActive(k); const p = routeFor[k] || '/'; navigate(p) }}
        onLogout={()=>supabase.auth.signOut()}
        isManager={isManager}
        onSearch={onSearch}
        notificationsCount={unread}
        onOpenNotifications={()=>setShowNotifs(v=>!v)}
        onOpenChangePassword={()=>setShowChangePwd(true)}
      />
      <div className='toast-container'>{toasts.map(t=> <div key={t.id} className='toast'>{t.msg}</div>)}</div>
      <ChangePasswordModal isOpen={showChangePwd} onClose={()=>setShowChangePwd(false)} user={user} onSuccess={msg=>pushToast(msg)} />
      {showNotifs && (
        <div className='search-overlay' onClick={()=>setShowNotifs(false)}>
          <div
            className='search-panel'
            role='dialog'
            aria-modal='true'
            tabIndex={-1}
            ref={notifPanelRef}
            onClick={e=>e.stopPropagation()}
          >
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
      <Routes>
        <Route path="/" element={<Home user={user} profile={profile} db={db} />} />
        <Route path="/attivita" element={<Attivita user={user} db={db} refresh={refresh} isManager={isManager} />} />
        <Route path="/rapportini" element={<Rapportini user={user} db={db} refresh={refresh} isManager={isManager} />} />
        <Route path="/bacheca" element={<Bacheca db={db} isManager={isManager} refresh={refresh} />} />
        <Route path="/turni" element={<TurniSettimanali isManager={isManager} />} />
        <Route path="/admin" element={isManager ? (<Amministrazione db={db} profiles={db.profiles} refresh={refresh} />) : (<Navigate to="/" replace />)} />
        <Route path="/utenti" element={isManager ? (<UtentiView />) : (<Navigate to="/" replace />)} />
        <Route path="/dashboard" element={isManager ? (<Dashboard />) : (<Navigate to="/" replace />)} />
        <Route path="/report" element={isManager ? (<Report />) : (<Navigate to="/" replace />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
