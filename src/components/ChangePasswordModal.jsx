import { useState } from 'react'
import { supabase } from '../_integration/supabaseClient.js'
import * as Icon from './Icons.jsx'

export default function ChangePasswordModal({ isOpen, onClose, user, onSuccess }){
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  async function handleSave(){
    setError('')
    if (!currentPwd || !newPwd || !confirmPwd){ setError('Compila tutti i campi'); return }
    if (newPwd.length < 8){ setError('La nuova password deve avere almeno 8 caratteri'); return }
    if (newPwd !== confirmPwd){ setError('Le password non coincidono'); return }
    setLoading(true)
    try{
      // 1) Verifica password attuale (re-auth)
      const { error: authErr } = await supabase.auth.signInWithPassword({ email: user?.email, password: currentPwd })
      if (authErr){ setError('Password attuale non corretta'); setLoading(false); return }
      // 2) Aggiorna password
      const { error: updErr } = await supabase.auth.updateUser({ password: newPwd })
      if (updErr){ setError(updErr.message); setLoading(false); return }
      onSuccess?.('Password aggiornata con successo')
      onClose?.()
    } catch(e){
      setError('Errore inatteso: ' + (e?.message || e))
    } finally{
      setLoading(false)
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
    }
  }

  return (
    <div className='search-overlay' onClick={onClose}>
      <div className='search-panel' onClick={e=>e.stopPropagation()}>
        <div style={{padding:12, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <span><Icon.Lock style={{marginRight:6}}/> Cambia password</span>
          <button className='btn' onClick={onClose}>Chiudi</button>
        </div>
        <div style={{padding:12, display:'grid', gap:8}}>
          <input type='password' placeholder='Password attuale' value={currentPwd} onChange={e=>setCurrentPwd(e.target.value)} />
          <input type='password' placeholder='Nuova password (min 8 caratteri)' value={newPwd} onChange={e=>setNewPwd(e.target.value)} />
          <input type='password' placeholder='Conferma nuova password' value={confirmPwd} onChange={e=>setConfirmPwd(e.target.value)} />
          {error && <div style={{color:'crimson'}}>{error}</div>}
          <div>
            <button className='btn primary' onClick={handleSave} disabled={loading}>{loading?'Salvo...':'Salva'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
