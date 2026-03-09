import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { Plus, Trash2, Flame, CheckCircle, Circle } from 'lucide-react'
import { format, subDays, eachDayOfInterval } from 'date-fns'
import { ar } from 'date-fns/locale'

const HABIT_ICONS = ['💪','📚','💧','🏃','🧘','🍎','😴','✍️','🎯','🔥','🌱','💊']
const HABIT_COLORS = ['#f59e0b','#3b82f6','#22c55e','#a855f7','#06b6d4','#ef4444','#f97316','#84cc16']

export default function Habits() {
  const { user }              = useAuthStore()
  const [habits, setHabits]   = useState([])
  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]       = useState({ name: '', icon: '💪', color: '#f59e0b', target_days: 7 })
  const [saving, setSaving]   = useState(false)

  const today = format(new Date(), 'yyyy-MM-dd')
  const last14 = eachDayOfInterval({ start: subDays(new Date(), 13), end: new Date() })

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const from = subDays(new Date(), 30).toISOString().split('T')[0]
    const [habitsRes, logsRes] = await Promise.all([
      supabase.from('habits').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('habit_logs').select('*').eq('user_id', user.id).gte('log_date', from),
    ])
    setHabits(habitsRes.data || [])
    setLogs(logsRes.data || [])
    setLoading(false)
  }

  function isDone(habitId, date) {
    return logs.some(l => l.habit_id === habitId && l.log_date === date)
  }

  function getStreak(habitId) {
    let streak = 0
    for (let i = 0; i < 30; i++) {
      const d = format(subDays(new Date(), i), 'yyyy-MM-dd')
      if (isDone(habitId, d)) streak++
      else if (i > 0) break
    }
    return streak
  }

  function getCompletionRate(habitId) {
    const done = last14.filter(d => isDone(habitId, format(d, 'yyyy-MM-dd'))).length
    return Math.round((done / 14) * 100)
  }

  async function toggleHabit(habitId, date) {
    const done = isDone(habitId, date)
    if (done) {
      await supabase.from('habit_logs').delete()
        .eq('habit_id', habitId).eq('log_date', date).eq('user_id', user.id)
      setLogs(prev => prev.filter(l => !(l.habit_id === habitId && l.log_date === date)))
    } else {
      const { data } = await supabase.from('habit_logs').insert({
        user_id: user.id, habit_id: habitId, log_date: date,
      }).select().single()
      if (data) setLogs(prev => [...prev, data])
    }
  }

  async function saveHabit() {
    if (!form.name.trim()) return
    setSaving(true)
    await supabase.from('habits').insert({ user_id: user.id, ...form })
    setForm({ name: '', icon: '💪', color: '#f59e0b', target_days: 7 })
    setShowForm(false); setSaving(false); fetchData()
  }

  async function deleteHabit(id) {
    await supabase.from('habits').delete().eq('id', id)
    await supabase.from('habit_logs').delete().eq('habit_id', id)
    setHabits(prev => prev.filter(h => h.id !== id))
  }

  const todayDone = habits.filter(h => isDone(h.id, today)).length

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>عاداتي اليومية 🔁</h1>
          <p style={{ fontSize: 13, color: '#475569', margin: '4px 0 0' }}>
            {todayDone} من {habits.length} عادة مكتملة اليوم
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> عادة جديدة
        </button>
      </div>

      {/* Today progress */}
      {habits.length > 0 && (
        <div className="card" style={{ marginBottom: 20, background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(34,197,94,0.06))', borderColor: '#f59e0b22' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
            <span style={{ color: '#e2e8f0', fontWeight: 500 }}>إنجاز اليوم</span>
            <span style={{ color: '#f59e0b', fontFamily: 'JetBrains Mono' }}>{todayDone}/{habits.length}</span>
          </div>
          <div className="progress-bar" style={{ height: 8 }}>
            <div className="progress-fill" style={{ width: `${habits.length ? (todayDone/habits.length)*100 : 0}%`, height: '100%' }} />
          </div>
          {todayDone === habits.length && habits.length > 0 && (
            <p style={{ fontSize: 13, color: '#22c55e', marginTop: 10, textAlign: 'center' }}>
              🎉 أحسنت! أكملت كل عاداتك اليوم!
            </p>
          )}
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="card fade-in" style={{ marginBottom: 20, borderColor: '#f59e0b44' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 14, marginTop: 0 }}>عادة جديدة</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>اسم العادة *</label>
              <input className="input" placeholder='مثال: "اشرب 8 أكواب مية"' value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>الأيقونة</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {HABIT_ICONS.map(icon => (
                  <button key={icon} onClick={() => setForm(p => ({ ...p, icon }))} style={{
                    width: 34, height: 34, borderRadius: 7, fontSize: 16, cursor: 'pointer',
                    border: `2px solid ${form.icon === icon ? '#f59e0b' : '#2a3040'}`,
                    background: form.icon === icon ? 'rgba(245,158,11,0.15)' : '#13161d',
                  }}>{icon}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>اللون</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {HABIT_COLORS.map(c => (
                  <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))} style={{
                    width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
                    border: `3px solid ${form.color === c ? '#fff' : 'transparent'}`,
                  }} />
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-primary" onClick={saveHabit} disabled={saving}>
              {saving ? 'جاري الحفظ...' : 'حفظ العادة'}
            </button>
            <button className="btn-ghost" onClick={() => setShowForm(false)}>إلغاء</button>
          </div>
        </div>
      )}

      {loading ? <p style={{ color: '#475569', fontSize: 13 }}>جاري التحميل...</p>
        : habits.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <p style={{ fontSize: 36, marginBottom: 10 }}>🔁</p>
            <p style={{ color: '#475569', fontSize: 13, marginBottom: 16 }}>ما عندكش عادات بعد!</p>
            <button className="btn-primary" onClick={() => setShowForm(true)}>+ أضف أول عادة</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {habits.map(habit => {
              const streak = getStreak(habit.id)
              const rate   = getCompletionRate(habit.id)
              const doneToday = isDone(habit.id, today)

              return (
                <div key={habit.id} className="card" style={{ borderRight: `3px solid ${habit.color}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                    {/* Icon + toggle today */}
                    <button onClick={() => toggleHabit(habit.id, today)} style={{
                      width: 44, height: 44, borderRadius: 12, fontSize: 22, cursor: 'pointer',
                      background: doneToday ? `${habit.color}20` : '#13161d',
                      border: `2px solid ${doneToday ? habit.color : '#2a3040'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s', flexShrink: 0,
                    }}>
                      {habit.icon}
                    </button>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: doneToday ? '#475569' : '#e2e8f0', textDecoration: doneToday ? 'line-through' : 'none' }}>
                          {habit.name}
                        </span>
                        {doneToday && <span style={{ fontSize: 11, color: '#22c55e' }}>✓ تم اليوم</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#475569' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Flame size={11} color={streak > 0 ? '#f59e0b' : '#475569'} />
                          {streak} يوم متتالي
                        </span>
                        <span>معدل الإنجاز: {rate}%</span>
                      </div>
                    </div>

                    <button onClick={() => deleteHabit(habit.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2a3040', padding: 4 }}
                      onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={e => e.currentTarget.style.color = '#2a3040'}>
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* 14-day heatmap */}
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {last14.map((d, i) => {
                      const dateStr = format(d, 'yyyy-MM-dd')
                      const done = isDone(habit.id, dateStr)
                      const isToday2 = dateStr === today
                      return (
                        <button key={i} onClick={() => toggleHabit(habit.id, dateStr)}
                          title={format(d, 'EEE d MMM', { locale: ar })}
                          style={{
                            flex: 1, height: 28, borderRadius: 5, cursor: 'pointer',
                            background: done ? habit.color : '#1e2330',
                            border: isToday2 ? `2px solid ${habit.color}` : '2px solid transparent',
                            opacity: done ? 1 : 0.5,
                            transition: 'all 0.15s',
                          }}
                        />
                      )
                    })}
                  </div>

                  {/* Completion bar */}
                  <div style={{ marginTop: 8 }}>
                    <div className="progress-bar" style={{ height: 4 }}>
                      <div style={{ height: '100%', width: `${rate}%`, background: habit.color, borderRadius: 2, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
    </div>
  )
}
