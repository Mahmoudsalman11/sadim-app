import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { predictGoalCompletion } from '../lib/ai'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend
} from 'recharts'
import { TrendingUp, Clock, Target, Zap, Calendar, Brain } from 'lucide-react'
import { format, subDays, startOfWeek, eachDayOfInterval } from 'date-fns'
import { ar } from 'date-fns/locale'

const CAT = {
  study:         { color: '#3b82f6', label: 'مذاكرة' },
  work:          { color: '#f59e0b', label: 'عمل' },
  entertainment: { color: '#a855f7', label: 'ترفيه' },
  exercise:      { color: '#22c55e', label: 'رياضة' },
  sleep:         { color: '#06b6d4', label: 'نوم' },
  other:         { color: '#94a3b8', label: 'أخرى' },
}

const TT_STYLE = { background: '#1e2330', border: '1px solid #2a3040', borderRadius: 8, fontSize: 12 }

export default function Analytics() {
  const { user } = useAuthStore()
  const [logs, setLogs]         = useState([])
  const [goals, setGoals]       = useState([])
  const [tasks, setTasks]       = useState([])
  const [avail, setAvail]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [predictions, setPredictions] = useState({})
  const [predLoading, setPredLoading] = useState(false)
  const [range, setRange]       = useState(7) // days

  useEffect(() => { fetchData(range) }, [range])

  async function fetchData(days = range) {
    setLoading(true)
    const from = subDays(new Date(), days).toISOString()
    const [logsRes, goalsRes, tasksRes, availRes] = await Promise.all([
      supabase.from('time_logs').select('*').eq('user_id', user.id).gte('started_at', from).order('started_at'),
      supabase.from('goals').select('*').eq('user_id', user.id),
      supabase.from('tasks').select('*').eq('user_id', user.id),
      supabase.from('availability_slots').select('*').eq('user_id', user.id),
    ])
    setLogs(logsRes.data || [])
    setGoals(goalsRes.data || [])
    setTasks(tasksRes.data || [])
    setAvail(availRes.data || [])
    setLoading(false)
  }

  async function loadPredictions() {
    if (!goals.length) return
    setPredLoading(true)
    const weeklyHours = avail.reduce((acc, s) => {
      const [fh, fm] = s.from_time.split(':').map(Number)
      const [th, tm] = s.to_time.split(':').map(Number)
      return acc + ((th * 60 + tm) - (fh * 60 + fm)) / 60
    }, 0)

    const results = {}
    for (const goal of goals.filter(g => g.status === 'active').slice(0, 3)) {
      try {
        results[goal.id] = await predictGoalCompletion({ goal, timeLogs: logs, weeklyHours })
      } catch {}
    }
    setPredictions(results)
    setPredLoading(false)
  }

  // Daily chart data
  const days = eachDayOfInterval({ start: subDays(new Date(), range - 1), end: new Date() })
  const dailyData = days.map(d => {
    const dayStr = format(d, 'yyyy-MM-dd')
    const dayLogs = logs.filter(l => l.started_at?.startsWith(dayStr) && l.ended_at)
    const mins = dayLogs.reduce((acc, l) => acc + Math.round((new Date(l.ended_at) - new Date(l.started_at)) / 60000), 0)
    return { day: format(d, 'EEE', { locale: ar }), mins, hours: +(mins / 60).toFixed(1) }
  })

  // Category pie
  const catMap = {}
  logs.filter(l => l.ended_at).forEach(l => {
    const mins = Math.round((new Date(l.ended_at) - new Date(l.started_at)) / 60000)
    catMap[l.category] = (catMap[l.category] || 0) + mins
  })
  const pieData = Object.entries(catMap).map(([cat, mins]) => ({
    name: CAT[cat]?.label || cat, value: mins, color: CAT[cat]?.color || '#94a3b8'
  }))

  // Stats
  const totalMins = logs.filter(l => l.ended_at).reduce((acc, l) => acc + Math.round((new Date(l.ended_at) - new Date(l.started_at)) / 60000), 0)
  const doneTasks = tasks.filter(t => t.status === 'done').length
  const avgDaily = range > 0 ? Math.round(totalMins / 30) : 0
  const bestDay = dailyData.reduce((best, d) => d.mins > best.mins ? d : best, { mins: 0, day: '—' })
  const streak = calcStreak(logs)

  // Weekly tasks completion
  const weeklyTaskData = Array.from({ length: 4 }, (_, i) => {
    const weekStart = subDays(new Date(), (3 - i) * 7 + 6)
    const weekEnd = subDays(new Date(), (3 - i) * 7)
    const weekTasks = tasks.filter(t => t.due_date >= format(weekStart, 'yyyy-MM-dd') && t.due_date <= format(weekEnd, 'yyyy-MM-dd'))
    const done = weekTasks.filter(t => t.status === 'done').length
    return { week: `أسبوع ${i + 1}`, total: weekTasks.length, done, pct: weekTasks.length ? Math.round((done / weekTasks.length) * 100) : 0 }
  })

  if (loading) return <div style={{ color: '#475569', padding: 40 }}>جاري تحميل التقارير...</div>

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>التقارير والتحليلات 📊</h1>
        <p style={{ fontSize: 13, color: '#475569', margin: '4px 0 0' }}>آخر 30 يوم من نشاطك</p>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'إجمالي الساعات', value: `${Math.floor(totalMins/60)}س ${totalMins%60}د`, icon: Clock, color: '#3b82f6' },
          { label: 'مهام منجزة', value: doneTasks, icon: Target, color: '#22c55e' },
          { label: 'متوسط يومي', value: `${avgDaily} د`, icon: TrendingUp, color: '#f59e0b' },
          { label: 'أيام متتالية 🔥', value: streak, icon: Zap, color: '#ef4444' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={18} color={color} />
            </div>
            <div>
              <p style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>{value}</p>
              <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Daily activity bar chart */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>النشاط اليومي</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {[7, 14, 30].map(d => (
              <button key={d} onClick={() => setRange(d)} style={{
                padding: '4px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                border: `1px solid ${range === d ? '#f59e0b' : '#2a3040'}`,
                background: range === d ? 'rgba(245,158,11,0.1)' : 'transparent',
                color: range === d ? '#f59e0b' : '#475569',
              }}>{d} يوم</button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={dailyData.slice(-range)}>
            <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} unit="د" />
            <Tooltip contentStyle={TT_STYLE} formatter={(v) => [`${v} دقيقة`, 'الوقت']} />
            <Bar dataKey="mins" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <p style={{ fontSize: 12, color: '#475569', margin: '12px 0 0', textAlign: 'center' }}>
          أفضل يوم: <span style={{ color: '#f59e0b' }}>{bestDay.day}</span> ({bestDay.mins} دقيقة)
        </p>
      </div>

      {/* Pie + Weekly tasks */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Pie */}
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 16, marginTop: 0 }}>توزيع الوقت بالفئات</h3>
          {pieData.length === 0 ? (
            <p style={{ color: '#475569', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>لا توجد بيانات بعد</p>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <ResponsiveContainer width={160} height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" stroke="none">
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={TT_STYLE} formatter={(v) => [`${v} دقيقة`, '']} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1 }}>
                {pieData.map((d, i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />
                      <span style={{ fontSize: 12, color: '#94a3b8', flex: 1 }}>{d.name}</span>
                      <span style={{ fontSize: 11, color: '#e2e8f0', fontFamily: 'JetBrains Mono' }}>
                        {Math.round(d.value/60)}س
                      </span>
                    </div>
                    <div className="progress-bar" style={{ height: 4 }}>
                      <div style={{ height: '100%', width: `${Math.round((d.value/totalMins)*100)}%`, background: d.color, borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Weekly tasks completion */}
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 16, marginTop: 0 }}>إنجاز المهام الأسبوعي</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weeklyTaskData}>
              <XAxis dataKey="week" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TT_STYLE} />
              <Bar dataKey="done" name="منجزة" fill="#22c55e" radius={[3,3,0,0]} />
              <Bar dataKey="total" name="الكل" fill="#2a3040" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* AI Goal Predictions */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Brain size={16} color="#a855f7" />
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>توقع تحقيق الأهداف</h3>
            <span className="badge badge-purple" style={{ fontSize: 11 }}>AI</span>
          </div>
          <button onClick={loadPredictions} disabled={predLoading} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)',
            borderRadius: 8, padding: '6px 14px', color: '#a855f7', cursor: 'pointer', fontSize: 12,
          }}>
            <Zap size={12} />{predLoading ? 'جاري التحليل...' : 'حلّل أهدافي'}
          </button>
        </div>

        {goals.filter(g => g.status === 'active').length === 0 ? (
          <p style={{ color: '#475569', fontSize: 13 }}>أضف أهدافاً أولاً من صفحة "أهدافي"</p>
        ) : Object.keys(predictions).length === 0 ? (
          <p style={{ color: '#475569', fontSize: 13 }}>اضغط "حلّل أهدافي" وسيتوقع الـ AI متى ستحقق كل هدف بناءً على معدل تقدمك الحالي 🔮</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {goals.filter(g => g.status === 'active').slice(0, 3).map(goal => {
              const pred = predictions[goal.id]
              if (!pred) return null
              return (
                <div key={goal.id} style={{ background: '#13161d', borderRadius: 10, padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{goal.title}</span>
                    <span className={`badge ${pred.on_track ? 'badge-green' : 'badge-red'}`}>
                      {pred.on_track ? '✓ في المسار' : '⚠ متأخر'}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                    {[
                      { label: 'التقدم الحالي', value: `${goal.progress}%` },
                      { label: 'وقت يومي مقترح', value: `${pred.daily_minutes} دقيقة` },
                      { label: 'التوقع', value: pred.expected_date || `${pred.weeks_needed} أسبوع` },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: 13, color: '#f59e0b', fontWeight: 700, margin: 0 }}>{value}</p>
                        <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>{label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="progress-bar" style={{ marginBottom: 8 }}>
                    <div className="progress-fill" style={{ width: `${goal.progress}%` }} />
                  </div>
                  <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>💡 {pred.advice}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function calcStreak(logs) {
  let streak = 0
  const today = new Date()
  for (let i = 0; i < 30; i++) {
    const dayStr = format(subDays(today, i), 'yyyy-MM-dd')
    const hasActivity = logs.some(l => l.started_at?.startsWith(dayStr) && l.ended_at)
    if (hasActivity) streak++
    else if (i > 0) break
  }
  return streak
}
