import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../_integration/supabaseClient.js'
import * as Icon from '../components/Icons.jsx'

function isoDate(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

function fmtDateTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function personName(row) {
  return row.profile_name || row.rams_user_name || row.profile_email || `DIN ${row.din}`
}

export default function Timbrature() {
  const [from, setFrom] = useState(isoDate(-7))
  const [to, setTo] = useState(isoDate(0))
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')

  async function load() {
    setLoading(true)
    setErr('')
    try {
      const fromIso = `${from}T00:00:00`
      const toIso = `${to}T23:59:59`
      const { data, error } = await supabase
        .from('rams_attendance_with_profiles')
        .select('*')
        .gte('clock_at', fromIso)
        .lte('clock_at', toIso)
        .order('clock_at', { ascending: false })
        .limit(1000)
      if (error) throw error
      setRows(data || [])
    } catch (e) {
      setRows([])
      setErr(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter(r => [
      personName(r),
      r.profile_email,
      r.rams_pin,
      r.dept_name,
      String(r.din || '')
    ].some(v => String(v || '').toLowerCase().includes(needle)))
  }, [rows, q])

  const stats = useMemo(() => {
    const people = new Set(filtered.map(r => r.profile_id || r.din))
    const linked = filtered.filter(r => r.profile_id).length
    return { total: filtered.length, people: people.size, linked }
  }, [filtered])

  return (
    <div className="container">
      <div className="card section">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ margin: 0 }}>
              <span className="icon-chip chip-turni" style={{ marginRight: 6 }}><Icon.Calendar /></span>
              Timbrature RAMS
            </h3>
            <div className="muted">Lettura delle timbrature sincronizzate dal programma RAMS.</div>
          </div>
          <button className="btn secondary" onClick={load} disabled={loading}>
            {loading ? 'Carico...' : 'Aggiorna'}
          </button>
        </div>

        <div className="grid4" style={{ marginTop: 12 }}>
          <label className="grid">
            <span className="muted">Da</span>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </label>
          <label className="grid">
            <span className="muted">A</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} />
          </label>
          <label className="grid">
            <span className="muted">Cerca</span>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Nome, matricola, reparto" />
          </label>
          <div className="row" style={{ alignItems: 'end' }}>
            <button className="btn primary" onClick={load} disabled={loading}>Filtra</button>
          </div>
        </div>

        {err && (
          <div className="alert warn" style={{ marginTop: 12 }}>
            {err.includes('relation') || err.includes('does not exist')
              ? 'Tabelle RAMS non ancora create. Esegui sql/add_rams_attendance.sql in Supabase.'
              : err}
          </div>
        )}
      </div>

      <div className="grid3" style={{ marginTop: 12 }}>
        <div className="summary-tile"><b>{stats.total}</b><div className="muted">Timbrature</div></div>
        <div className="summary-tile"><b>{stats.people}</b><div className="muted">Persone</div></div>
        <div className="summary-tile"><b>{stats.linked}</b><div className="muted">Collegate a profili</div></div>
      </div>

      <div className="card section" style={{ marginTop: 12 }}>
        <h3><span className="icon-chip chip-report" style={{ marginRight: 6 }}><Icon.List /></span> Registro</h3>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Ora</th>
                <th>Dipendente</th>
                <th>Matricola</th>
                <th>RAMS</th>
                <th>Reparto</th>
                <th>Tipo</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={`${r.din}-${r.clock_at}-${i}`}>
                  <td>{fmtDateTime(r.clock_at)}</td>
                  <td>{personName(r)}</td>
                  <td>{r.matricola || '-'}</td>
                  <td>{r.rams_pin || r.din}</td>
                  <td>{r.dept_name || '-'}</td>
                  <td>{r.att_type_id || r.action || '-'}</td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan="6" className="muted">Nessuna timbratura nel periodo selezionato.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

