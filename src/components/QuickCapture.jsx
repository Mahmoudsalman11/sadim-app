import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { Plus, X, CheckSquare, Target, StickyNote } from 'lucide-react'

export default function QuickCapture() {
  const { user }            = useAuthStore()
  const [open, setOpen]     = useState(false)
  const [text, setText]     = useState('')
  const [type, setType]     = useState('task')
  const [saving, setSaving] = useState(false)
  const [done, setDone]     = useState(false)
  const inputRef            = useRef(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  // Keyboard shortcut: Ctrl+Space
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.code === 'Space') { e.preventDefault(); setOpen(o => !o) }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  async function handleSave() {
    if (!text.trim()) return
    setSaving(true)
    const today = new Date().toISOString().split('T')[0]

    if (type === 'task') {
      await supabase.from('tasks').insert({ user_id:user.id, title:text.trim(), priority:'medium', due_date:today, status:'pending' })
    } else if (type === 'goal') {
      await supabase.from('goals').insert({ user_id:user.id, title:text.trim(), category:'other', priority:'medium', status:'active', progress:0 })
    }
    // note — just local for now (could add notes table later)

    setSaving(false)
    setDone(true)
    setText('')
    setTimeout(() => { setDone(false); setOpen(false); setType('task') }, 1200)
  }

  const TYPES = [
    { key:'task', icon:CheckSquare, label:'مهمة', color:'#f59e0b' },
    { key:'goal', icon:Target,      label:'هدف',  color:'#3b82f6' },
    { key:'note', icon:StickyNote,  label:'ملاحظة', color:'#22c55e' },
  ]

  return (
    <>
      {/* Floating Button */}
      <button onClick={() => setOpen(o => !o)} style={{
        position:'fixed', bottom:28, left:28, zIndex:500,
        width:52, height:52, borderRadius:'50%',
        background:'linear-gradient(135deg,#f59e0b,#fbbf24)',
        border:'none', cursor:'pointer',
        display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow:'0 4px 20px rgba(245,158,11,0.4)',
        transition:'all 0.2s',
        transform: open ? 'rotate(45deg)' : 'rotate(0)',
      }}>
        <Plus size={22} color="#0d0f14" strokeWidth={2.5} />
      </button>

      {/* Tooltip */}
      {!open && (
        <div style={{
          position:'fixed', bottom:32, left:90, zIndex:499,
          background:'#1e2330', border:'1px solid #2a3040',
          borderRadius:8, padding:'5px 10px',
          fontSize:11, color:'#94a3b8', pointerEvents:'none',
          opacity:0, animation:'fadeHint 3s ease 2s forwards',
        }}>
          Ctrl+Space
          <style>{`@keyframes fadeHint{0%{opacity:0}20%{opacity:1}80%{opacity:1}100%{opacity:0}}`}</style>
        </div>
      )}

      {/* Modal */}
      {open && (
        <>
          {/* Backdrop */}
          <div onClick={() => setOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:600, backdropFilter:'blur(2px)' }} />

          {/* Panel */}
          <div style={{
            position:'fixed', bottom:90, left:28, zIndex:700,
            background:'#1e2330', border:'1px solid #2a3040',
            borderRadius:16, padding:20, width:320,
            boxShadow:'0 16px 48px rgba(0,0,0,0.5)',
            animation:'slideUp 0.2s ease',
          }}>
            <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <span style={{ fontSize:14, fontWeight:600, color:'#e2e8f0' }}>إضافة سريعة ⚡</span>
              <button onClick={() => setOpen(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#475569' }}>
                <X size={14} />
              </button>
            </div>

            {/* Type selector */}
            <div style={{ display:'flex', gap:6, marginBottom:12 }}>
              {TYPES.map(({ key, icon:Icon, label, color }) => (
                <button key={key} onClick={() => setType(key)} style={{
                  flex:1, padding:'7px 4px', borderRadius:8, fontSize:11,
                  cursor:'pointer', border:`1px solid ${type===key?color:'#2a3040'}`,
                  background: type===key?`${color}18`:'transparent',
                  color: type===key?color:'#475569',
                  display:'flex', flexDirection:'column', alignItems:'center', gap:3,
                  transition:'all 0.15s',
                }}>
                  <Icon size={13} />{label}
                </button>
              ))}
            </div>

            {/* Input */}
            <input
              ref={inputRef}
              className="input"
              placeholder={type==='task'?'اكتب مهمة...':type==='goal'?'اكتب هدف...':'اكتب ملاحظة...'}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              style={{ marginBottom:12 }}
            />

            <button onClick={handleSave} disabled={saving || !text.trim()} style={{
              width:'100%', padding:'10px', borderRadius:9, border:'none',
              background: done?'#22c55e':'linear-gradient(135deg,#f59e0b,#fbbf24)',
              color:'#0d0f14', fontWeight:700, fontSize:13,
              cursor:'pointer', transition:'all 0.2s',
              fontFamily:'IBM Plex Sans Arabic',
            }}>
              {done ? '✅ تم الحفظ!' : saving ? 'جاري...' : 'حفظ (Enter)'}
            </button>
          </div>
        </>
      )}
    </>
  )
}
