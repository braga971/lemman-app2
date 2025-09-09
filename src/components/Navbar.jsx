import * as Icon from './Icons.jsx'

export default function Navbar({ tabs, active, onChange, onLogout, isManager, onSearch, notificationsCount=0, onOpenNotifications, theme='light', onToggleTheme, onOpenChangePassword }){
  return (
    <nav className="nav">
      <div className="container" style={{display:'flex', alignItems:'center'}}>
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
          <button className="tab" onClick={onToggleTheme} title="Tema">{theme==='dark'?<Icon.Sun />:<Icon.Moon />}</button>
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
