import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { Play, Square, Trash2, Clock, Timer } from 'lucide-react'

export default function TimeLog() {
  const { user } = useAuthStore()
  const [logs, setLogs]     = useState([])
  const [tasks, setTasks]   = useState([])
  const [active, setActive] = useState(null) // running timer
  const [elapsed, setElapsed] = useState(0)  // seconds
  const [form, setForm]     = useState({ task_id: '', category: 'study', note: '' })
  const [loading, setLoading] = useState(true)

  const CATEGORIES = [
    { value: 'study',       label: 'مذاكرة',   color: '#3b82f6' },
    { value: 'work',        label: 'عمل',      color: '#f59e0b' },
    { value: 'entertainment',label: 'ترفيه',   color: '#a855f7' },
    { value: 'exercise',    label: 'رياضة',    color: '#22c55e' },
    { value: 'sleep',       label: 'نوم',      color: '#06b6d4' },
    { value: 'other',       label: 'أخرى',     color: '#94a3b8' },
  ]

  useEffect(() => { fetchData() }, [])

  // Tick timer
  useEffect(() => {
    if (!active) return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(active.started_at)) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [active])

  // Restore active timer on mount
  useEffect(() => {
    supabase.from('time_logs').select('*')
      .eq('user_id', user.id).is('ended_at', null).maybeSingle()
      .then(({ data }) => { if (data) setActive(data) })
  }, [])

  async function fetchData() {
    setLoading(true)
    const todayStr = new Date().toISOString().split('T')[0]
    const [logsRes, tasksRes] = await Promise.all([
      supabase.from('time_logs').select('*, tasks(title)').eq('user_id', user.id)
        .gte('started_at', todayStr).order('started_at', { ascending: false }),
      supabase.from('tasks').select('id, title').eq('user_id', user.id).neq('status', 'done'),
    ])
    setLogs(logsRes.data || [])
    setTasks(tasksRes.data || [])
    setLoading(false)
  }

  async function startTimer() {
    if (active) return
    const { data } = await supabase.from('time_logs').insert({
      user_id: user.id,
      task_id: form.task_id || null,
      category: form.category,
      note: form.note || null,
      started_at: new Date().toISOString(),
    }).select().single()
    setActive(data)
    setElapsed(0)
  }

  async function stopTimer() {
    if (!active) return
    await supabase.from('time_logs').update({ ended_at: new Date().toISOString() }).eq('id', active.id)
    setActive(null)
    setElapsed(0)
    fetchData()
  }

  async function deleteLog(id) {
    await supabase.from('time_logs').delete().eq('id', id)
    setLogs(prev => prev.filter(l => l.id !== id))
  }

  function fmtElapsed(secs) {
    const h = Math.floor(secs / 3600).toString().padStart(2, '0')
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  function fmtDuration(started, ended) {
    if (!ended) return '—'
    const mins = Math.round((new Date(ended) - new Date(started)) / 60000)
    if (mins < 60) return `${mins} دقيقة`
    return `${(mins / 60).toFixed(1)} ساعة`
  }

  const totalMins = logs.filter(l => l.ended_at).reduce((acc, l) => {
    return acc + Math.round((new Date(l.ended_at) - new Date(l.started_at)) / 60000)
  }, 0)

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>سجل الوقت ⏱️</h1>
        <p style={{ fontSize: 13, color: '#475569', margin: '4px 0 0' }}>
          اليوم: {Math.floor(totalMins / 60)} ساعة و {totalMins % 60} دقيقة مسجّلة
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Timer card */}
        <div className="card" style={active ? { borderColor: '#22c55e44', background: 'rgba(34,197,94,0.03)' } : {}}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 16, marginTop: 0 }}>
            {active ? '⏳ مؤقت قيد التشغيل' : '▶ ابدأ تتبع الوقت'}
          </h3>

          {active ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{
                fontSize: 36, fontFamily: 'JetBrains Mono', color: '#22c55e',
                marginBottom: 8, letterSpacing: 2,
              }}>
                {fmtElapsed(elapsed)}
              </div>
              <p style={{ fontSize: 13, color: '#475569', marginBottom: 20 }}>
                {CATEGORIES.find(c => c.value === active.category)?.label}
              </p>
              <button
                onClick={stopTimer}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  margin: '0 auto', padding: '10px 24px',
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 8, color: '#ef4444', cursor: 'pointer', fontSize: 13,
                }}
              >
                <Square size={14} fill="#ef4444" /> إيقاف وحفظ
              </button>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>الفئة</label>
                <select className="input" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>مرتبط بمهمة (اختياري)</label>
                <select className="input" value={form.task_id} onChange={e => setForm(p => ({ ...p, task_id: e.target.value }))}>
                  <option value="">بدون مهمة</option>
                  {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>ملاحظة (اختياري)</label>
                <input className="input" placeholder="ماذا ستفعل؟" value={form.note}
                  onChange={e => setForm(p => ({ ...p, note: e.target.value }))} />
              </div>
              <button className="btn-primary" onClick={startTimer} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'center' }}>
                <Play size={13} fill="#0d0f14" /> ابدأ المؤقت
              </button>
            </div>
          )}
        </div>

        {/* Category summary */}
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 16, marginTop: 0 }}>توزيع وقت اليوم</h3>
          {CATEGORIES.map(cat => {
            const catMins = logs.filter(l => l.category === cat.value && l.ended_at).reduce((acc, l) => {
              return acc + Math.round((new Date(l.ended_at) - new Date(l.started_at)) / 60000)
            }, 0)
            if (catMins === 0) return null
            const pct = totalMins ? Math.round((catMins / totalMins) * 100) : 0
            return (
              <div key={cat.value} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
                  <span>{cat.label}</span>
                  <span>{Math.floor(catMins / 60)}س {catMins % 60}د ({pct}%)</span>
                </div>
                <div className="progress-bar">
                  <div style={{ height: '100%', width: `${pct}%`, background: cat.color, borderRadius: 3, transition: 'width 0.4s' }} />
                </div>
              </div>
            )
          })}
          {totalMins === 0 && <p style={{ color: '#475569', fontSize: 13 }}>لا توجد سجلات لليوم بعد</p>}
        </div>
      </div>

      {/* Log history */}
      <div className="card">
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 16, marginTop: 0 }}>سجل اليوم</h3>
        {loading ? (
          <p style={{ color: '#475569', fontSize: 13 }}>جاري التحميل...</p>
        ) : logs.length === 0 ? (
          <p style={{ color: '#475569', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>لا توجد سجلات لليوم</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {logs.map(log => {
              const cat = CATEGORIES.find(c => c.value === log.category)
              return (
                <div key={log.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 0', borderBottom: '1px solid #1e2330',
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: cat?.color || '#94a3b8', flexShrink: 0,
                  }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, color: '#e2e8f0', margin: 0 }}>
                      {cat?.label} {log.note ? `— ${log.note}` : ''}
                    </p>
                    <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>
                      {new Date(log.started_at).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
                      {log.ended_at && ` — ${new Date(log.ended_at).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}`}
                    </p>
                  </div>
                  <span style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'JetBrains Mono' }}>
                    {fmtDuration(log.started_at, log.ended_at)}
                  </span>
                  <button
                    onClick={() => deleteLog(log.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2a3040', padding: 4 }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={e => e.currentTarget.style.color = '#2a3040'}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
