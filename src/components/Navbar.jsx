import * as Icon from './Icons.jsx'

export default function Navbar({ tabs, active, onChange, onLogout, isManager }){
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
        <div className="right">
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
