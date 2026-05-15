import { useEffect, useState } from 'react'
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
]

const routeFor = {
  home: '/',
  attivita: '/attivita',
  rapportini: '/rapportini',
  bacheca: '/bacheca',
  turni_settimanali: '/turni',
  admin: '/admin',
  utenti: '/utenti',
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
      { queryKey:['profiles'], queryFn: async()=> (await supabase.from('profiles').select('*').order('matricola', {ascending:true, nullsFirst:false}).order('created_at', {ascending:true})).data||[], enabled },
    ]
  })
  const [qCantieri,qCommesse,qPosizioni,qTasks,qBacheca,qRapportini,qProfiles] = results
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

  // Notifiche rimosse
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
      .subscribe()
    return ()=>{ try{ supabase.removeChannel(ch) }catch(_){ /* ignore */ } }
  }, [user])

  // Notifiche rimosse: nessuna cancellazione o overlay

  // Pannello notifiche rimosso: nessuna gestione overlay

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
        onOpenChangePassword={()=>setShowChangePwd(true)}
      />
      <div className='toast-container'>{toasts.map(t=> <div key={t.id} className='toast'>{t.msg}</div>)}</div>
      <ChangePasswordModal isOpen={showChangePwd} onClose={()=>setShowChangePwd(false)} user={user} onSuccess={msg=>pushToast(msg)} />
      {/* Pannello notifiche rimosso */}
      {searchOpen && (
        <div className='search-overlay' onClick={()=>setSearchOpen(false)}>
          <div className='search-panel' onClick={e=>e.stopPropagation()}>
            {searchQ && <div style={{padding:12,fontWeight:700}}>Risultati per: {searchQ}</div>}
            {searchResults.map((r,i)=> (
              <div key={i} className='item' onClick={()=>{
                const next = r.type === 'task' ? 'attivita' : r.type === 'bacheca' ? 'bacheca' : 'rapportini'
                setActive(next)
                navigate(routeFor[next] || '/')
                setSearchOpen(false)
              }}>
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
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="/report" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
