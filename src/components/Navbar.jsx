import { useEffect, useRef, useState } from 'react'
import * as Icon from './Icons.jsx'

export default function Navbar({ tabs, active, onChange, onLogout, isManager, onSearch, notificationsCount=0, onOpenNotifications, onOpenChangePassword }){
  const [menuOpen,setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  useEffect(()=>{
    function onDoc(e){ if(menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    if(menuOpen){ document.addEventListener('mousedown', onDoc) }
    return ()=> document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])
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
            <div style={{position:'absolute', top:36, left:0, background:'var(--card)', color:'var(--text)', border:'1px solid var(--border)', borderRadius:10, minWidth:200, boxShadow:'0 10px 24px rgba(0,0,0,0.2)', zIndex:20}} role="menu">
              {tabs.map(t=>{
                if (t.manager && !isManager) return null
                const isActive = active===t.key
                return (
                  <div key={t.key} role="menuitem">
                    <button className="btn" style={{background:'transparent', width:'100%', textAlign:'left', borderRadius:0, padding:'10px 12px', color:'inherit'}} onClick={()=>{ onChange(t.key); setMenuOpen(false) }}>
                      <span style={{display:'inline-flex', alignItems:'center', gap:8}}>
                        {t.icon || null}
                        <span style={{fontWeight:isActive?700:500}}>{t.label}</span>
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div className="tabs">
          {tabs.map(t=>{
            if (t.manager && !isManager) return null
            return (
              <button key={t.key} className={"tab"+(active===t.key?' active':'')} onClick={()=>onChange(t.key)}>
                <span style={{display:'inline-flex', alignItems:'center', gap:6}}>
                  {t.icon || null}
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

