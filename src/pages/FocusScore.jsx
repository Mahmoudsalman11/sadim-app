import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { getSmartAdvice } from '../lib/ai'
import { format, subDays, eachDayOfInterval } from 'date-fns'
import { ar } from 'date-fns/locale'
import { Zap, TrendingUp, TrendingDown, Minus, Sparkles, RefreshCw } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

// حساب نقطة الإنتاجية اليومية (0-100)
function calcScore({ tasks, timeLogs, habits, habitLogs, date }) {
  const dayStr = date

  // 1. إنجاز المهام (40 نقطة)
  const dayTasks  = tasks.filter(t => t.due_date === dayStr)
  const doneTasks = dayTasks.filter(t => t.status === 'done').length
  const taskScore = dayTasks.length > 0 ? (doneTasks / dayTasks.length) * 40 : 0

  // 2. وقت العمل (35 نقطة) — target: 4 ساعات = 100%
  const dayLogs   = timeLogs.filter(l => l.started_at?.startsWith(dayStr) && l.ended_at)
  const totalMins = dayLogs.reduce((acc, l) => acc + Math.round((new Date(l.ended_at) - new Date(l.started_at)) / 60000), 0)
  const timeScore = Math.min((totalMins / 240) * 35, 35)

  // 3. العادات (25 نقطة)
  const dayHabits = habitLogs.filter(l => l.log_date === dayStr).length
  const habitScore = habits.length > 0 ? (dayHabits / habits.length) * 25 : 0

  return Math.round(taskScore + timeScore + habitScore)
}

function getScoreLevel(score) {
  if (score >= 85) return { label: 'ممتاز 🔥',    color: '#22c55e', bg: 'rgba(34,197,94,0.1)' }
  if (score >= 65) return { label: 'جيد جداً ✨',  color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' }
  if (score >= 45) return { label: 'مقبول 📈',     color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' }
  if (score >= 25) return { label: 'ضعيف ⚠️',      color: '#f97316', bg: 'rgba(249,115,22,0.1)' }
  return           { label: 'يوم صعب 😔',          color: '#ef4444', bg: 'rgba(239,68,68,0.1)' }
}

const TT_STYLE = { background: '#1e2330', border: '1px solid #2a3040', borderRadius: 8, fontSize: 12 }

export default function FocusScore() {
  const { user }          = useAuthStore()
  const [data, setData]   = useState({ tasks:[], logs:[], habits:[], habitLogs:[] })
  const [scores, setScores] = useState([])
  const [advice, setAdvice] = useState('')
  const [adviceLoading, setAdviceLoading] = useState(false)
  const [loading, setLoading] = useState(true)

  const last30 = eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() })
  const today  = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const from = subDays(new Date(), 30).toISOString()
    const [tasksRes, logsRes, habitsRes, habitLogsRes] = await Promise.all([
      supabase.from('tasks').select('*').eq('user_id', user.id),
      supabase.from('time_logs').select('*').eq('user_id', user.id).gte('started_at', from),
      supabase.from('habits').select('*').eq('user_id', user.id),
      supabase.from('habit_logs').select('*').eq('user_id', user.id).gte('log_date', subDays(new Date(),30).toISOString().split('T')[0]),
    ])
    const d = {
      tasks: tasksRes.data || [],
      logs: logsRes.data || [],
      habits: habitsRes.data || [],
      habitLogs: habitLogsRes.data || [],
    }
    setData(d)

    // حساب نقطة كل يوم
    const dailyScores = last30.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd')
      const score = calcScore({ tasks: d.tasks, timeLogs: d.logs, habits: d.habits, habitLogs: d.habitLogs, date: dateStr })
      return {
        date: dateStr,
        day: format(day, 'EEE', { locale: ar }),
        score,
        isToday: dateStr === today,
      }
    })
    setScores(dailyScores)
    setLoading(false)
  }

  async function loadAdvice() {
    setAdviceLoading(true)
    try {
      const text = await getSmartAdvice({ goals: [], tasks: data.tasks.filter(t => t.due_date === today), timeLogs: data.logs })
      setAdvice(text)
    } catch { setAdvice('تعذّر تحميل النصيحة') }
    setAdviceLoading(false)
  }

  const todayScore  = scores.find(s => s.isToday)?.score || 0
  const avgScore    = scores.length ? Math.round(scores.reduce((a, s) => a + s.score, 0) / scores.length) : 0
  const bestScore   = Math.max(...scores.map(s => s.score), 0)
  const last7Avg    = scores.slice(-7).length ? Math.round(scores.slice(-7).reduce((a,s) => a+s.score, 0) / scores.slice(-7).length) : 0
  const prev7Avg    = scores.slice(-14,-7).length ? Math.round(scores.slice(-14,-7).reduce((a,s) => a+s.score, 0) / scores.slice(-14,-7).length) : 0
  const trend       = last7Avg - prev7Avg

  const todayLevel  = getScoreLevel(todayScore)

  // Gauge circle
  const radius = 70, circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (todayScore / 100) * circumference

  if (loading) return <div style={{ color: '#475569', padding: 40 }}>جاري الحساب...</div>

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>نقطة التركيز 🎯</h1>
        <p style={{ fontSize: 13, color: '#475569', margin: '4px 0 0' }}>قياس إنتاجيتك اليومية بشكل موضوعي</p>
      </div>

      {/* Today score — big gauge */}
      <div className="card" style={{ marginBottom: 20, textAlign: 'center', background: `linear-gradient(135deg, ${todayLevel.bg}, transparent)`, borderColor: todayLevel.color + '44' }}>
        <p style={{ fontSize: 13, color: '#475569', marginBottom: 16 }}>نقطة اليوم — {format(new Date(), 'EEEE d MMMM', { locale: ar })}</p>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <svg width="180" height="180" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="90" cy="90" r={radius} fill="none" stroke="#1e2330" strokeWidth="10" />
            <circle cx="90" cy="90" r={radius} fill="none" stroke={todayLevel.color}
              strokeWidth="10" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 1s ease' }}
            />
          </svg>
          <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: 50 }}>
            <span style={{ fontSize: 48, fontWeight: 800, color: todayLevel.color, fontFamily: 'JetBrains Mono', lineHeight: 1 }}>{todayScore}</span>
            <span style={{ fontSize: 13, color: '#475569' }}>/ 100</span>
          </div>
        </div>
        <span style={{ fontSize: 16, fontWeight: 600, color: todayLevel.color }}>{todayLevel.label}</span>

        {/* Score breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 20 }}>
          {[
            { label: 'إنجاز المهام', max: 40, desc: '40 نقطة' },
            { label: 'وقت العمل', max: 35, desc: '35 نقطة' },
            { label: 'العادات', max: 25, desc: '25 نقطة' },
          ].map(({ label, max, desc }) => (
            <div key={label} style={{ background: '#13161d', borderRadius: 8, padding: 10 }}>
              <p style={{ fontSize: 11, color: '#475569', margin: '0 0 4px' }}>{label}</p>
              <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'متوسط 30 يوم', value: avgScore, color: '#3b82f6' },
          { label: 'أفضل يوم', value: bestScore, color: '#22c55e' },
          { label: 'متوسط أسبوع', value: last7Avg, color: '#f59e0b' },
          {
            label: 'الاتجاه', value: trend > 0 ? `+${trend}` : `${trend}`,
            color: trend > 0 ? '#22c55e' : trend < 0 ? '#ef4444' : '#475569',
            icon: trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus,
          },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="card" style={{ textAlign: 'center', padding: 14 }}>
            {Icon && <Icon size={16} color={color} style={{ display: 'block', margin: '0 auto 6px' }} />}
            <p style={{ fontSize: 22, fontWeight: 700, color, margin: 0, fontFamily: 'JetBrains Mono' }}>{value}</p>
            <p style={{ fontSize: 11, color: '#475569', margin: '4px 0 0' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* 30-day line chart */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 16, marginTop: 0 }}>آخر 30 يوم</h3>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={scores}>
            <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false}
              interval={4} />
            <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TT_STYLE} formatter={(v) => [`${v} نقطة`, 'النقطة']} />
            <ReferenceLine y={avgScore} stroke="#2a3040" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="score" stroke="#f59e0b" strokeWidth={2.5}
              dot={(props) => props.payload.isToday
                ? <circle key={props.key} cx={props.cx} cy={props.cy} r={5} fill="#f59e0b" stroke="#0d0f14" strokeWidth={2} />
                : <circle key={props.key} cx={props.cx} cy={props.cy} r={2} fill="#f59e0b44" />
              }
            />
          </LineChart>
        </ResponsiveContainer>
        <p style={{ fontSize: 11, color: '#475569', textAlign: 'center', margin: '8px 0 0' }}>
          الخط المتقطع = المتوسط ({avgScore} نقطة)
        </p>
      </div>

      {/* Heatmap */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 14, marginTop: 0 }}>Heatmap آخر 30 يوم</h3>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {scores.map((s, i) => {
            const opacity = s.score === 0 ? 0.08 : 0.15 + (s.score / 100) * 0.85
            return (
              <div key={i} title={`${s.date}: ${s.score} نقطة`} style={{
                width: 28, height: 28, borderRadius: 5,
                background: `rgba(245,158,11,${opacity})`,
                border: s.isToday ? '2px solid #f59e0b' : '2px solid transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, color: s.score > 50 ? '#f59e0b' : '#475569',
                cursor: 'default',
              }}>
                {s.score > 0 ? s.score : ''}
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 11, color: '#475569' }}>
          <span>أقل</span>
          {[0.08, 0.3, 0.55, 0.75, 1].map((op, i) => (
            <div key={i} style={{ width: 14, height: 14, borderRadius: 3, background: `rgba(245,158,11,${op})` }} />
          ))}
          <span>أكثر</span>
        </div>
      </div>

      {/* AI Advice */}
      <div className="card" style={{ borderColor: '#f59e0b33', background: 'rgba(245,158,11,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={14} color="#f59e0b" />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b' }}>نصيحة لتحسين نقطتك</span>
          </div>
          <button onClick={loadAdvice} disabled={adviceLoading} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 7, padding: '5px 12px', color: '#f59e0b', cursor: 'pointer', fontSize: 11,
          }}>
            <RefreshCw size={11} />{adviceLoading ? 'جاري...' : 'احصل على نصيحة'}
          </button>
        </div>
        <p style={{ fontSize: 13, color: advice ? '#cbd5e1' : '#475569', margin: 0, lineHeight: 1.7 }}>
          {advice || `نقطتك اليوم ${todayScore}/100 — اضغط "احصل على نصيحة" لتحسينها 🎯`}
        </p>
      </div>
    </div>
  )
}
