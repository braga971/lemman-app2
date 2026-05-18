import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../_integration/supabaseClient.js'
import * as Icon from '../components/Icons.jsx'

const MEAL_ITEMS = [
  {
    key: 'primo',
    label: 'Primo',
    icon: 'plate',
    max: 2,
    placeholder: 'Seleziona o scrivi primo',
    options: [
      'Pasta corta al ragu',
      'Pasta corta al pomodoro',
      'Pasta corta bianca',
      'Pasta corta amatriciana',
      'Pasta corta arrabbiata',
      'Pasta corta aglio olio peperoncino',
      'Spaghetti al ragu',
      'Spaghetti al pomodoro',
      'Spaghetti bianchi',
      'Spaghetti amatriciana',
      'Spaghetti arrabbiata',
      'Spaghetti aglio olio peperoncino',
      'Riso al ragu',
      'Riso al pomodoro',
      'Riso bianco',
    ],
  },
  {
    key: 'secondo',
    label: 'Secondo',
    icon: 'fork',
    max: 2,
    placeholder: 'Seleziona o scrivi secondo',
    options: [
      'Cotoletta di pollo',
      'Cotoletta di maiale',
      'Bistecca',
      'Calamari fritti',
      'Petto di pollo',
    ],
  },
  {
    key: 'contorno',
    label: 'Contorno',
    icon: 'leaf',
    max: 2,
    placeholder: 'Seleziona o scrivi contorno',
    options: [
      'Insalata verde',
      'Insalata mista',
      'Fagioli con cipolla',
      'Pomodorini',
      'Patate fritte',
      'Patate al forno',
      'Verdure grigliate',
    ],
  },
  { key: 'pizza', label: 'Pizza', icon: 'pizza', max: 1, placeholder: 'Scrivi gusto pizza' },
  { key: 'panino', label: 'Panino', icon: 'sandwich', max: 1, placeholder: 'Scrivi tipo panino' },
  { key: 'insalatona', label: 'Insalatona', icon: 'salad', max: 1, placeholder: 'Scrivi tipo insalatona' },
]

const SINGLE_KEYS = ['pizza', 'panino', 'insalatona']
const PLATE_KEYS = ['primo', 'secondo', 'contorno']
const SERVICE_OPTIONS = [
  { value: 'pranzo', label: 'Pranzo', deadline: '11:00' },
  { value: 'cena', label: 'Cena', deadline: '19:30' },
]

const DEFAULT_ITEMS = {
  primo: 0,
  secondo: 0,
  contorno: 0,
  pizza: 0,
  panino: 0,
  insalatona: 0,
}

const DEFAULT_DETAILS = {
  primo: [],
  secondo: [],
  contorno: [],
  pizza: [],
  panino: [],
  insalatona: [],
}

export default function Mensa({ user, db, refresh, isManager=false, isMensaUser=false }){
  const today = localDateInput(new Date())
  const [date, setDate] = useState(today)
  const [service, setService] = useState('')
  const [cantiere, setCantiere] = useState('')
  const [items, setItems] = useState(DEFAULT_ITEMS)
  const [details, setDetails] = useState(DEFAULT_DETAILS)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const rows = db.mensa_ordini || []
  const myChoice = useMemo(()=> rows.find(r=> r.user_id === user.id && r.data === date), [rows, user.id, date])
  const dayRows = useMemo(()=> rows.filter(r=> r.data === date), [rows, date])
  const order = useMemo(()=> normalizeOrder(items, details), [items, details])
  const dailySiteTotals = useMemo(()=> buildSiteMealTotals(dayRows), [dayRows])
  const monthlySiteTotals = useMemo(()=> buildMonthlySiteMealTotals(rows, date), [rows, date])
  const dailyGroups = useMemo(()=> groupOrdersBySiteAndService(dayRows, db.profiles), [dayRows, db.profiles])
  const canViewMensaTables = isManager || isMensaUser
  const isMensaOnly = isMensaUser && !isManager
  const monday = isMonday(date)
  const deadlineMessage = orderDeadlineMessage(date, service)

  useEffect(()=>{
    if (myChoice){
      const nextItems = readItems(myChoice)
      setService(myChoice.servizio || '')
      setCantiere(myChoice.cantiere || '')
      setItems(nextItems)
      setDetails(syncDetails(nextItems, readDetails(myChoice)))
      setNote(myChoice.note || '')
    } else {
      setService('')
      setCantiere('')
      setItems(DEFAULT_ITEMS)
      setDetails(DEFAULT_DETAILS)
      setNote('')
    }
  }, [myChoice?.id, date])

  useEffect(()=>{
    if (monday && service === 'cena') setService('')
  }, [monday, service])

  function changeItem(key, delta){
    setItems(current=>{
      const item = MEAL_ITEMS.find(x=>x.key===key)
      const max = item?.max || 2
      const nextValue = Math.max(0, Math.min(max, Number(current[key] || 0) + delta))
      const next = { ...current, [key]: nextValue }

      if (SINGLE_KEYS.includes(key) && nextValue > 0){
        for (const k of Object.keys(next)) if (k !== key) next[k] = 0
      } else if (PLATE_KEYS.includes(key) && nextValue > 0){
        for (const k of SINGLE_KEYS) next[k] = 0
      }

      setDetails(currentDetails=> syncDetails(next, currentDetails))
      return next
    })
  }

  function updateDetail(key, index, value){
    setDetails(current=>{
      const list = [...(current[key] || [])]
      list[index] = value
      return { ...current, [key]: list }
    })
  }

  async function saveChoice(){
    if (isPastDate(date)){
      alert('Non puoi ordinare per giorni gia passati.')
      return
    }
    if (!service){
      alert('Seleziona se l ordine e per pranzo o per cena.')
      return
    }
    if (monday && service === 'cena'){
      alert('Il lunedi puoi selezionare solo il pranzo.')
      return
    }
    if (deadlineMessage){
      alert(deadlineMessage)
      return
    }
    if (!cantiere){
      alert('Seleziona il cantiere dove deve arrivare il cibo.')
      return
    }
    if (order.total === 0){
      alert('Seleziona almeno una voce mensa.')
      return
    }

    setSaving(true)
    const payload = {
      user_id: user.id,
      data: date,
      servizio: service,
      cantiere,
      scelta: order.summary,
      items,
      details,
      extra_items: order.extraItems,
      extra_message: order.extraMessage,
      note: note.trim() || null,
    }
    const { error } = await supabase
      .from('mensa_ordini')
      .upsert(payload, { onConflict: 'user_id,data' })
    setSaving(false)
    if (error){
      alert(error.message)
      return
    }
    await (refresh && refresh())
  }

  async function removeChoice(){
    if (!myChoice) return
    const ok = window.confirm('Vuoi cancellare la scelta mensa per questa data?')
    if (!ok) return
    const { error } = await supabase
      .from('mensa_ordini')
      .delete()
      .eq('id', myChoice.id)
    if (error){
      alert(error.message)
      return
    }
    await (refresh && refresh())
  }

  return (
    <div className="container" style={{paddingTop:16}}>
      {!isMensaOnly && (
        <section className="card section">
          <h3><span className="icon-chip chip-mensa" style={{marginRight:6}}><Icon.Utensils/></span> Mensa</h3>
          <div className="grid4">
            <input type="date" min={today} value={date} onChange={e=>setDate(e.target.value)} />
            <select value={service} onChange={e=>setService(e.target.value)}>
              <option value="">- Pranzo o cena -</option>
              {SERVICE_OPTIONS.map(option=>(
                <option key={option.value} value={option.value} disabled={option.value==='cena' && monday}>
                  {option.label} entro le {option.deadline}
                </option>
              ))}
            </select>
            <select value={cantiere} onChange={e=>setCantiere(e.target.value)}>
              <option value="">- Cantiere consegna -</option>
              {(db.cantieri || []).map(c=> <option key={c.id || c.name} value={c.name}>{c.name}</option>)}
            </select>
            <input placeholder="Nota facoltativa" value={note} onChange={e=>setNote(e.target.value)} />
          </div>
          {monday && <div className="muted" style={{marginTop:8}}>Il lunedi e disponibile solo il pranzo.</div>}
          {deadlineMessage && <div className="alert warn" style={{marginTop:8}}>{deadlineMessage}</div>}

          <div className="meal-grid" style={{marginTop:12}}>
            {MEAL_ITEMS.map(item=>(
              <MealCard
                key={item.key}
                item={item}
                count={Number(items[item.key] || 0)}
                details={details[item.key] || []}
                onMinus={()=>changeItem(item.key, -1)}
                onPlus={()=>changeItem(item.key, 1)}
                onDetail={updateDetail}
              />
            ))}
          </div>

          {order.total > 0 && (
            <div className={order.extraMessage ? 'alert warn' : 'alert ok'} style={{marginTop:12}}>
              <strong>Ordine:</strong> {order.summary}
              {order.extraMessage && <div style={{marginTop:4}}>{order.extraMessage}</div>}
            </div>
          )}

          <div className="row" style={{gap:8, marginTop:10, alignItems:'center'}}>
            <button className="btn" onClick={saveChoice} disabled={saving}>
              <Icon.Save/> {saving ? 'Salvataggio...' : 'Salva scelta'}
            </button>
            {myChoice && <button className="btn secondary" onClick={removeChoice}><Icon.Trash/> Cancella</button>}
            <span className="muted">
              {myChoice ? `Scelta salvata: ${serviceLabel(myChoice.servizio)} - ${myChoice.cantiere || '-'} - ${formatSavedOrder(myChoice)}` : 'Nessuna scelta salvata per questa data'}
            </span>
          </div>
        </section>
      )}

      {canViewMensaTables && (
        <section className="card section" style={{marginTop:16}}>
          <h3><span className="icon-chip chip-mensa" style={{marginRight:6}}><Icon.List/></span> Ordini mensa</h3>
          <div className="grid2" style={{marginBottom:12}}>
            <div>
              <label>Data ordini</label>
              <input type="date" value={date} onChange={e=>setDate(e.target.value)} />
            </div>
          </div>
          <h4 style={{margin:'0 0 8px'}}>Ordini del giorno {date} divisi per cantiere</h4>
          {dailyGroups.length === 0 && <div className="muted" style={{marginBottom:16}}>Nessun ordine per questa data</div>}
          {dailyGroups.map(group=>(
            <div key={`${group.cantiere}-${group.servizio}`} style={{marginBottom:18}}>
              <h4 style={{margin:'0 0 8px'}}>{group.cantiere} - {serviceLabel(group.servizio)}</h4>
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr><th>Dipendente</th><th>Ordine</th><th>Extra</th><th>Nota</th></tr>
                  </thead>
                  <tbody>
                    {group.rows.map(r=>(
                      <tr key={r.id}>
                        <td>{personName(db.profiles, r.user_id)}</td>
                        <td>{formatSavedOrder(r)}</td>
                        <td>{r.extra_message || '-'}</td>
                        <td>{r.note || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {isManager && (
            <>
              <h4 style={{margin:'0 0 8px'}}>Totale giornaliero per cantiere</h4>
              <div className="table-responsive" style={{marginBottom:16}}>
                <table className="table">
                  <thead>
                    <tr><th>Cantiere</th><th>Pranzo</th><th>Cena</th><th>Pasti equivalenti</th><th>Pezzi cucina</th><th>Pizza/Panino/Insalatona</th><th>Ordini</th></tr>
                  </thead>
                  <tbody>
                    {dailySiteTotals.length === 0 && (
                      <tr><td colSpan="7" style={{textAlign:'center', opacity:0.7}}>Nessun pasto per questa data</td></tr>
                    )}
                    {dailySiteTotals.map(row=>(
                      <tr key={row.cantiere}>
                        <td>{row.cantiere}</td>
                        <td>{formatMealQty(row.pranzoMeals)}</td>
                        <td>{formatMealQty(row.cenaMeals)}</td>
                        <td><strong>{formatMealQty(row.meals)}</strong></td>
                        <td>{row.platePieces}</td>
                        <td>{row.singleMeals}</td>
                        <td>{row.orders}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h4 style={{margin:'0 0 8px'}}>Totale mese per cantiere</h4>
              <div className="table-responsive" style={{marginBottom:16}}>
                <table className="table">
                  <thead>
                    <tr><th>Cantiere</th><th>Mese</th><th>Pranzo</th><th>Cena</th><th>Pasti equivalenti</th><th>Ordini</th></tr>
                  </thead>
                  <tbody>
                    {monthlySiteTotals.length === 0 && (
                      <tr><td colSpan="6" style={{textAlign:'center', opacity:0.7}}>Nessun pasto nel mese selezionato</td></tr>
                    )}
                    {monthlySiteTotals.map(row=>(
                      <tr key={row.cantiere}>
                        <td>{row.cantiere}</td>
                        <td>{monthLabel(date)}</td>
                        <td>{formatMealQty(row.pranzoMeals)}</td>
                        <td>{formatMealQty(row.cenaMeals)}</td>
                        <td><strong>{formatMealQty(row.meals)}</strong></td>
                        <td>{row.orders}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {isManager && <div className="table-responsive">
            <table className="table">
              <thead>
                <tr><th>Dipendente</th><th>Turno</th><th>Cantiere</th><th>Ordine</th><th>Extra</th><th>Nota</th><th>Inserito</th></tr>
              </thead>
              <tbody>
                {dayRows.length === 0 && (
                  <tr><td colSpan="7" style={{textAlign:'center', opacity:0.7}}>Nessuna scelta per questa data</td></tr>
                )}
                {dayRows
                  .slice()
                  .sort((a,b)=> personName(db.profiles, a.user_id).localeCompare(personName(db.profiles, b.user_id), 'it'))
                  .map(r=>(
                    <tr key={r.id}>
                      <td>{personName(db.profiles, r.user_id)}</td>
                      <td>{serviceLabel(r.servizio)}</td>
                      <td>{r.cantiere || '-'}</td>
                      <td>{formatSavedOrder(r)}</td>
                      <td>{r.extra_message || '-'}</td>
                      <td>{r.note || '-'}</td>
                      <td>{r.created_at ? new Date(r.created_at).toLocaleString('it-IT') : '-'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>}
        </section>
      )}
    </div>
  )
}

function MealCard({ item, count, details, onMinus, onPlus, onDetail }){
  return (
    <div className={'meal-card' + (count > 0 ? ' selected' : '')}>
      <div className="meal-visual"><MealIcon name={item.icon}/></div>
      <div style={{fontWeight:800}}>{item.label}</div>
      <div className="meal-counter">
        <button type="button" className="btn secondary" onClick={onMinus} disabled={count===0}>-</button>
        <strong>{count}</strong>
        <button type="button" className="btn secondary" onClick={onPlus} disabled={count>=item.max}>+</button>
      </div>
      {count > 0 && (
        <div className="meal-details">
          {Array.from({ length: count }).map((_, index)=>(
            <div key={`${item.key}-${index}`}>
              <input
                list={item.options ? `mensa-${item.key}-${index}` : undefined}
                value={details[index] || ''}
                onChange={e=>onDetail(item.key, index, e.target.value)}
                placeholder={count > 1 ? `${item.placeholder} ${index + 1}` : item.placeholder}
              />
              {item.options && (
                <datalist id={`mensa-${item.key}-${index}`}>
                  {item.options.map(option=> <option key={option} value={option} />)}
                </datalist>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MealIcon({ name }){
  if (name === 'pizza') return (
    <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M12 10l42 14-34 30z" fill="#f59e0b"/><path d="M12 10c12 3 27 8 42 14" fill="none" stroke="#92400e" strokeWidth="5"/><circle cx="28" cy="27" r="4" fill="#dc2626"/><circle cx="39" cy="32" r="4" fill="#dc2626"/><circle cx="26" cy="41" r="3" fill="#16a34a"/></svg>
  )
  if (name === 'sandwich') return (
    <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 24c6-12 42-12 48 0v8H8z" fill="#fbbf24"/><path d="M10 34h44v14H10z" fill="#f97316"/><path d="M12 34c10 7 28 7 40 0" fill="none" stroke="#16a34a" strokeWidth="5"/><path d="M10 48h44" stroke="#92400e" strokeWidth="5"/></svg>
  )
  if (name === 'salad' || name === 'leaf') return (
    <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M14 34h36l-5 16H19z" fill="#0f766e"/><path d="M18 30c3-12 16-16 23-9-9 1-14 6-16 13" fill="#22c55e"/><path d="M32 30c4-10 14-12 19-5-7 1-11 4-13 10" fill="#84cc16"/><circle cx="28" cy="39" r="3" fill="#ef4444"/></svg>
  )
  if (name === 'fork') return (
    <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M16 8v18M24 8v18M20 8v48" stroke="#111827" strokeWidth="5" strokeLinecap="round"/><path d="M42 8v48M42 8c10 8 9 24 0 30" stroke="#111827" strokeWidth="5" strokeLinecap="round" fill="none"/></svg>
  )
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="22" fill="#e5e7eb" stroke="#111827" strokeWidth="4"/><circle cx="32" cy="32" r="11" fill="#f97316"/></svg>
  )
}

function readItems(row){
  if (row?.items && typeof row.items === 'object'){
    return { ...DEFAULT_ITEMS, ...row.items }
  }
  const legacy = String(row?.scelta || '')
  return { ...DEFAULT_ITEMS, [legacy]: legacy ? 1 : 0 }
}

function readDetails(row){
  if (row?.details && typeof row.details === 'object'){
    return { ...DEFAULT_DETAILS, ...row.details }
  }
  return DEFAULT_DETAILS
}

function syncDetails(items, currentDetails){
  const next = {}
  for (const item of MEAL_ITEMS){
    const count = Number(items[item.key] || 0)
    const list = [...(currentDetails[item.key] || [])].slice(0, count)
    while (list.length < count) list.push('')
    next[item.key] = list
  }
  return next
}

function normalizeOrder(items, details){
  const entries = MEAL_ITEMS
    .map(item=>({ ...item, count: Number(items[item.key] || 0), details: details[item.key] || [] }))
    .filter(item=>item.count > 0)
  const expanded = []
  for (const item of entries){
    for (let i=0; i<item.count; i++){
      const detail = String(item.details[i] || '').trim()
      expanded.push(detail ? `${item.label}: ${detail}` : item.label)
    }
  }
  const total = expanded.length
  const summary = expanded.join(', ')
  const extraItems = expanded.slice(3)
  const extraMessage = extraItems.length
    ? `Pasto in piu: ${extraItems.join(', ')}. Non e servito dall'azienda e verra pagato dal dipendente.`
    : null
  return { total, summary, extraItems, extraMessage }
}

function formatSavedOrder(row){
  if (!row) return '-'
  if (row.items) return normalizeOrder(readItems(row), readDetails(row)).summary || '-'
  return row.scelta || '-'
}

function serviceLabel(value){
  return SERVICE_OPTIONS.find(option=>option.value===value)?.label || 'Pranzo'
}

function serviceOrder(value){
  return value === 'cena' ? 2 : 1
}

function buildSiteMealTotals(rows){
  const map = new Map()
  for (const row of rows || []){
    const cantiere = row.cantiere || 'Senza cantiere'
    const current = map.get(cantiere) || {
      cantiere,
      orders: 0,
      platePieces: 0,
      singleMeals: 0,
      meals: 0,
      pranzoMeals: 0,
      cenaMeals: 0,
    }
    const meal = mealCountForRow(row)
    current.orders += 1
    current.platePieces += meal.platePieces
    current.singleMeals += meal.singleMeals
    current.meals += meal.meals
    if ((row.servizio || 'pranzo') === 'cena') current.cenaMeals += meal.meals
    else current.pranzoMeals += meal.meals
    map.set(cantiere, current)
  }
  return [...map.values()].sort((a,b)=> a.cantiere.localeCompare(b.cantiere, 'it'))
}

function groupOrdersBySiteAndService(rows, profiles){
  const map = new Map()
  for (const row of rows || []){
    const cantiere = row.cantiere || 'Senza cantiere'
    const servizio = row.servizio || 'pranzo'
    const key = `${cantiere}|${servizio}`
    const group = map.get(key) || { cantiere, servizio, rows: [] }
    group.rows.push(row)
    map.set(key, group)
  }
  return [...map.values()]
    .map(group=>({
      ...group,
      rows: group.rows
        .slice()
        .sort((a,b)=>{
          return personName(profiles, a.user_id).localeCompare(personName(profiles, b.user_id), 'it')
        }),
    }))
    .sort((a,b)=>{
      const site = a.cantiere.localeCompare(b.cantiere, 'it')
      if (site !== 0) return site
      return serviceOrder(a.servizio) - serviceOrder(b.servizio)
    })
}

function buildMonthlySiteMealTotals(rows, date){
  const monthKey = String(date || '').slice(0, 7)
  return buildSiteMealTotals((rows || []).filter(row=> String(row.data || '').slice(0, 7) === monthKey))
}

function mealCountForRow(row){
  const items = readItems(row)
  const platePieces = PLATE_KEYS.reduce((sum,key)=> sum + Number(items[key] || 0), 0)
  const singleMeals = SINGLE_KEYS.reduce((sum,key)=> sum + Number(items[key] || 0), 0)
  return {
    platePieces,
    singleMeals,
    meals: (platePieces / 3) + singleMeals,
  }
}

function formatMealQty(value){
  return Number(value || 0).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function monthLabel(date){
  const [year, month] = String(date || '').split('-')
  return `${month || '--'}/${year || '----'}`
}

function personName(profiles, userId){
  const p = (profiles || []).find(x=>x.id===userId)
  return p?.full_name || p?.email || userId || '-'
}

function localDateInput(date){
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function dateFromInput(value){
  const [y,m,d] = String(value || '').split('-').map(Number)
  return new Date(y || 1970, (m || 1) - 1, d || 1)
}

function isPastDate(value){
  return String(value || '') < localDateInput(new Date())
}

function isMonday(value){
  return dateFromInput(value).getDay() === 1
}

function orderDeadlineMessage(date, service){
  const today = localDateInput(new Date())
  if (String(date || '') !== today) return ''
  const now = new Date()
  const minutes = now.getHours() * 60 + now.getMinutes()
  if (service === 'pranzo' && minutes > 11 * 60){
    return 'Per il pranzo l ordine deve essere fatto entro le 11:00 dello stesso giorno.'
  }
  if (service === 'cena' && minutes > (19 * 60 + 30)){
    return 'Per la cena l ordine deve essere fatto entro le 19:30 dello stesso giorno.'
  }
  return ''
}
