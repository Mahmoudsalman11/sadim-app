import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { generateWeeklyPlan } from '../lib/ai'
import { Sparkles, Calendar, RefreshCw, Target, CheckSquare } from 'lucide-react'
import { format, startOfWeek, addDays } from 'date-fns'
import { ar } from 'date-fns/locale'

const DAY_COLORS = ['#f59e0b','#3b82f6','#22c55e','#a855f7','#06b6d4','#ef4444','#f97316']

export default function WeeklyPlanner() {
  const { user } = useAuthStore()
  const [plan, setPlan]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [goals, setGoals]     = useState([])
  const [tasks, setTasks]     = useState([])
  const [avail, setAvail]     = useState([])
  const [weekTasks, setWeekTasks] = useState([])

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 6 })
  const weekDays  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const weekStartStr = format(weekStart, 'yyyy-MM-dd')
    const weekEndStr   = format(addDays(weekStart, 6), 'yyyy-MM-dd')
    const [g, t, a, wt] = await Promise.all([
      supabase.from('goals').select('*').eq('user_id', user.id).eq('status', 'active'),
      supabase.from('tasks').select('*').eq('user_id', user.id).neq('status', 'done'),
      supabase.from('availability_slots').select('*').eq('user_id', user.id),
      supabase.from('tasks').select('*').eq('user_id', user.id)
        .gte('due_date', weekStartStr).lte('due_date', weekEndStr),
    ])
    setGoals(g.data || [])
    setTasks(t.data || [])
    setAvail(a.data || [])
    setWeekTasks(wt.data || [])
  }

  async function generatePlan() {
    setLoading(true)
    try {
      const result = await generateWeeklyPlan({ goals, tasks, availability: avail })
      setPlan(result)
    } catch { alert('تعذّر إنشاء الخطة، تأكد من الـ API Key') }
    setLoading(false)
  }

  async function addTaskFromPlan(taskTitle, dayIndex) {
    const date = format(addDays(weekStart, dayIndex), 'yyyy-MM-dd')
    await supabase.from('tasks').insert({
      user_id: user.id, title: taskTitle, priority: 'medium',
      due_date: date, status: 'pending',
    })
    fetchData()
    alert(`✅ أُضيفت "${taskTitle}" ليوم ${format(addDays(weekStart, dayIndex), 'EEEE', { locale: ar })}`)
  }

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>المخطط الأسبوعي 📅</h1>
          <p style={{ fontSize: 13, color: '#475569', margin: '4px 0 0' }}>
            {format(weekStart, 'd MMM', { locale: ar })} — {format(addDays(weekStart, 6), 'd MMM yyyy', { locale: ar })}
          </p>
        </div>
        <button onClick={generatePlan} disabled={loading} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={14} />{loading ? 'جاري الإنشاء...' : 'اصنع خطة أسبوعية بـ AI'}
        </button>
      </div>

      {/* Week grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10, marginBottom: 24 }}>
        {weekDays.map((day, i) => {
          const dayStr   = format(day, 'yyyy-MM-dd')
          const dayTasks = weekTasks.filter(t => t.due_date === dayStr)
          const isToday  = dayStr === format(new Date(), 'yyyy-MM-dd')
          const hasAvail = avail.some(a => {
            const dayMap = { saturday: 6, sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5 }
            return dayMap[a.day] === day.getDay()
          })
          return (
            <div key={i} className="card" style={{
              padding: 12, minHeight: 120,
              borderColor: isToday ? DAY_COLORS[i] + '66' : undefined,
              background: isToday ? `${DAY_COLORS[i]}08` : undefined,
            }}>
              <div style={{ marginBottom: 8 }}>
                <p style={{ fontSize: 11, color: DAY_COLORS[i], fontWeight: 600, margin: 0 }}>
                  {format(day, 'EEE', { locale: ar })}
                  {isToday && <span style={{ marginRight: 4, fontSize: 9, background: DAY_COLORS[i], color: '#0d0f14', padding: '1px 5px', borderRadius: 4 }}>اليوم</span>}
                </p>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>{format(day, 'd')}</p>
              </div>
              {!hasAvail && <p style={{ fontSize: 10, color: '#2a3040', margin: '0 0 6px' }}>لا فراغ</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {dayTasks.slice(0, 3).map(t => (
                  <div key={t.id} style={{
                    fontSize: 11, color: t.status === 'done' ? '#475569' : '#94a3b8',
                    background: '#13161d', borderRadius: 4, padding: '3px 6px',
                    textDecoration: t.status === 'done' ? 'line-through' : 'none',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {t.status === 'done' ? '✓ ' : '• '}{t.title}
                  </div>
                ))}
                {dayTasks.length > 3 && <p style={{ fontSize: 10, color: '#475569', margin: 0 }}>+{dayTasks.length - 3} أكثر</p>}
              </div>
            </div>
          )
        })}
      </div>

      {/* AI Plan */}
      {!plan && !loading && (
        <div className="card" style={{ textAlign: 'center', padding: 48, background: 'linear-gradient(135deg, rgba(245,158,11,0.04), rgba(168,85,247,0.04))', borderColor: '#f59e0b22' }}>
          <Sparkles size={36} color="#f59e0b" style={{ marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: 16, color: '#e2e8f0', marginBottom: 8 }}>خطة أسبوعية بالذكاء الاصطناعي</h3>
          <p style={{ fontSize: 13, color: '#475569', marginBottom: 20, maxWidth: 400, margin: '0 auto 20px' }}>
            بناءً على أهدافك ومهامك وأوقات فراغك، سيصنع لك Claude خطة أسبوعية مخصصة لك
          </p>
          <button onClick={generatePlan} disabled={loading} className="btn-primary">
            اصنع خطتي الأسبوعية 🚀
          </button>
        </div>
      )}

      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div className="pulse-soft">
            <Sparkles size={32} color="#f59e0b" style={{ display: 'block', margin: '0 auto 12px' }} />
            <p style={{ color: '#94a3b8', fontSize: 14 }}>Claude يحلل أهدافك ويصنع خطتك...</p>
          </div>
        </div>
      )}

      {plan && (
        <div className="fade-in">
          {/* Motivation */}
          <div className="card" style={{ marginBottom: 20, borderColor: '#f59e0b33', background: 'rgba(245,158,11,0.04)', textAlign: 'center', padding: 20 }}>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 6px' }}>هدف الأسبوع</p>
            <h3 style={{ fontSize: 16, color: '#f59e0b', margin: '0 0 10px' }}>{plan.week_goal}</h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0, fontStyle: 'italic' }}>"{plan.motivation}"</p>
          </div>

          {/* Day plans */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {(plan.days || []).map((day, i) => (
              <div key={i} className="card" style={{ borderRight: `3px solid ${DAY_COLORS[i % 7]}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: `${DAY_COLORS[i%7]}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Calendar size={16} color={DAY_COLORS[i % 7]} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>{day.day}</h3>
                      <span style={{ fontSize: 12, color: DAY_COLORS[i%7], background: `${DAY_COLORS[i%7]}18`, padding: '2px 8px', borderRadius: 10 }}>{day.focus}</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                      {(day.tasks || []).map((task, j) => (
                        <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#13161d', borderRadius: 6, padding: '5px 10px', fontSize: 12, color: '#94a3b8' }}>
                          <CheckSquare size={11} color={DAY_COLORS[i%7]} />
                          <span>{task}</span>
                          <button onClick={() => addTaskFromPlan(task, i)} style={{ background: 'none', border: 'none', color: DAY_COLORS[i%7], cursor: 'pointer', fontSize: 11, padding: 0, marginRight: 2 }}>
                            + أضف
                          </button>
                        </div>
                      ))}
                    </div>
                    <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>💡 {day.tip}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button onClick={generatePlan} disabled={loading} className="btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <RefreshCw size={13} /> إعادة إنشاء الخطة
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
