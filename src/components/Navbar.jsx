import { useEffect, useRef, useState } from 'react'
import * as Icon from './Icons.jsx'

export default function Navbar({ tabs, active, onChange, onLogout, isManager, onSearch, notificationsCount=0, onOpenNotifications, onOpenChangePassword }){
  const [menuOpen,setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const [isMobile,setIsMobile] = useState(()=> (typeof window!=='undefined' ? window.innerWidth <= 768 : false))
  const [theme,setTheme] = useState(()=> (localStorage.getItem('theme')||'').toLowerCase()==='dark' ? 'dark' : 'light')
  useEffect(()=>{
    function onDoc(e){ if(menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    if(menuOpen){ document.addEventListener('mousedown', onDoc) }
    return ()=> document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])
  useEffect(()=>{
    function onResize(){ setIsMobile(window.innerWidth <= 768) }
    window.addEventListener('resize', onResize)
    return ()=> window.removeEventListener('resize', onResize)
  }, [])
  useEffect(()=>{
    if(theme==='dark'){ document.documentElement.setAttribute('data-theme','dark') } else { document.documentElement.removeAttribute('data-theme') }
    localStorage.setItem('theme', theme)
  }, [theme])
  const colorClassFor = (key)=>{
    switch(key){
      case 'home': return 'chip-home'
      case 'attivita': return 'chip-attivita'
      case 'rapportini': return 'chip-rapportini'
      case 'bacheca': return 'chip-bacheca'
      case 'turni_settimanali': return 'chip-turni'
      case 'admin': return 'chip-admin'
      case 'utenti': return 'chip-utenti'
      case 'dashboard': return 'chip-dashboard'
      case 'report': return 'chip-report'
      default: return 'chip-default'
    }
  }
  return (
    <nav className="nav">
      <div className="container" style={{display:'flex', alignItems:'center'}}>
        <div style={{marginRight:8, position:'relative'}} ref={menuRef}>
          <button className="tab" onClick={()=>setMenuOpen(v=>!v)} title="Menu" aria-haspopup="true" aria-expanded={menuOpen? 'true':'false'}>
            <span style={{display:'inline-flex', alignItems:'center', gap:6}}>
              <Icon.List />
              Menu
            </span>
          </button>
          {menuOpen && (
            isMobile ? (
              <>
                <div className="drawer-overlay" onClick={()=>setMenuOpen(false)}></div>
                <div className="drawer-panel open" role="menu">
                  <div style={{fontWeight:800, padding:'10px 12px'}}>Menu</div>
                  {tabs.map(t=>{
                    if (t.manager && !isManager) return null
                    const isActive = active===t.key
                    return (
                      <div key={t.key} role="menuitem">
                        <button className="btn menu-item" style={{background:'transparent', width:'100%', textAlign:'left', borderRadius:0, padding:'10px 12px', color:'inherit'}} onClick={()=>{ onChange(t.key); setMenuOpen(false) }}>
                          <span style={{display:'inline-flex', alignItems:'center', gap:10}}>
                            <span className={`icon-chip ${colorClassFor(t.key)}`}>{t.icon || null}</span>
                            <span style={{fontWeight:isActive?700:500}}>{t.label}</span>
                          </span>
                        </button>
                      </div>
                    )
                  })}
                  <div style={{height:1, background:'var(--border)', margin:'8px 0'}}></div>
                  <button className="btn menu-item" style={{background:'transparent', width:'100%', textAlign:'left', borderRadius:0, padding:'10px 12px'}} onClick={()=>{ setMenuOpen(false); onOpenChangePassword && onOpenChangePassword() }}>
                    <span style={{display:'inline-flex', alignItems:'center', gap:10}}>
                      <span className="icon-chip chip-utenti"><Icon.Lock/></span>
                      Cambia password
                    </span>
                  </button>
                  <button className="btn menu-item" style={{background:'transparent', width:'100%', textAlign:'left', borderRadius:0, padding:'10px 12px'}} onClick={()=>{ setMenuOpen(false); onLogout && onLogout() }}>
                    <span style={{display:'inline-flex', alignItems:'center', gap:10}}>
                      <span className="icon-chip chip-admin"><Icon.LogOut/></span>
                      Esci
                    </span>
                  </button>
                </div>
              </>
            ) : (
              <div className="menu-dropdown" role="menu">
                {tabs.map(t=>{
                  if (t.manager && !isManager) return null
                  const isActive = active===t.key
                  return (
                    <div key={t.key} role="menuitem">
                      <button className="btn menu-item" style={{background:'transparent', width:'100%', textAlign:'left', borderRadius:0, padding:'10px 12px', color:'inherit'}} onClick={()=>{ onChange(t.key); setMenuOpen(false) }}>
                        <span style={{display:'inline-flex', alignItems:'center', gap:10}}>
                          <span className={`icon-chip ${colorClassFor(t.key)}`}>{t.icon || null}</span>
                          <span style={{fontWeight:isActive?700:500}}>{t.label}</span>
                        </span>
                      </button>
                    </div>
                  )
                })}
                <div style={{height:1, background:'var(--border)', margin:'6px 0'}}></div>
                <button className="btn menu-item" style={{background:'transparent', width:'100%', textAlign:'left', borderRadius:0, padding:'10px 12px'}} onClick={()=>{ setMenuOpen(false); onOpenChangePassword && onOpenChangePassword() }}>
                  <span style={{display:'inline-flex', alignItems:'center', gap:10}}>
                    <span className="icon-chip chip-utenti"><Icon.Lock/></span>
                    Cambia password
                  </span>
                </button>
                <button className="btn menu-item" style={{background:'transparent', width:'100%', textAlign:'left', borderRadius:0, padding:'10px 12px'}} onClick={()=>{ setMenuOpen(false); onLogout && onLogout() }}>
                  <span style={{display:'inline-flex', alignItems:'center', gap:10}}>
                    <span className="icon-chip chip-admin"><Icon.LogOut/></span>
                    Esci
                  </span>
                </button>
              </div>
            )
          )}
        </div>
        <div className="tabs">
          {tabs.map(t=>{
            if (t.manager && !isManager) return null
            return (
              <button key={t.key} className={"tab"+(active===t.key?' active':'')} onClick={()=>onChange(t.key)}>
                <span style={{display:'inline-flex', alignItems:'center', gap:8}}>
                  <span className={`icon-chip ${colorClassFor(t.key)}`}>{t.icon || null}</span>
                  {t.label}
                </span>
              </button>
            )
          })}
        </div>
        <div className="right" style={{display:'flex', alignItems:'center', gap:8, marginLeft:'auto'}}>
          <div className="m-hide" style={{position:'relative'}}>
            <input placeholder="Cerca..." onKeyDown={(e)=>{ if(e.key==='Enter' && onSearch) onSearch(e.target.value) }} style={{borderRadius:999,padding:'6px 10px',border:'none',outline:'none'}} />
          </div>
          <button className="tab" onClick={onOpenNotifications} title="Notifiche" style={{position:'relative'}}>
            <Icon.Bell />
            {notificationsCount>0 && <span style={{position:'absolute',top:2,right:2,background:'tomato',color:'#fff',borderRadius:999,padding:'0 6px',fontSize:11}}>{notificationsCount}</span>}
          </button>
          <button className="tab" onClick={()=> setTheme(t=> t==='dark'?'light':'dark')} title={theme==='dark'?'Tema chiaro':'Tema scuro'}>
            {theme==='dark' ? <Icon.Sun/> : <Icon.Moon/>}
          </button>
          <button className="tab" onClick={onOpenChangePassword} title="Cambia password"><Icon.Lock /> Password</button>
          <button className="tab" onClick={onLogout} title="Esci">
            <span style={{display:'inline-flex', alignItems:'center', gap:6}}>
              <Icon.LogOut /> Esci
            </span>
          </button>
        </div>
      </div>
    </nav>
  )
}
