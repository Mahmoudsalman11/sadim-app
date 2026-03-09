import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { smartTaskBreakdown, checkGoalTimeSufficiency, buildDailySchedule } from '../lib/ai'
import {
  Sparkles, Brain, Calendar, Plus, ChevronDown, ChevronUp,
  CheckCircle, AlertCircle, Clock, Zap, Target, ArrowLeft
} from 'lucide-react'

const TABS = [
  { key: 'breakdown', icon: Brain,     label: 'تقسيم المهمة' },
  { key: 'checker',   icon: Target,    label: 'كفاية الوقت' },
  { key: 'schedule',  icon: Calendar,  label: 'جدول اليوم' },
]

const TYPE_COLORS = {
  work:   '#f59e0b', study: '#3b82f6', break: '#22c55e',
  exercise: '#a855f7', other: '#94a3b8',
}
const TYPE_LABELS = {
  work: 'عمل', study: 'مذاكرة', break: 'استراحة', exercise: 'رياضة', other: 'أخرى',
}

export default function SmartPlanner() {
  const { user } = useAuthStore()
  const [tab, setTab]         = useState('breakdown')
  const [goals, setGoals]     = useState([])
  const [tasks, setTasks]     = useState([])
  const [avail, setAvail]     = useState([])
  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(false)

  // Breakdown state
  const [taskInput, setTaskInput]   = useState('')
  const [breakdown, setBreakdown]   = useState(null)
  const [addedSubs, setAddedSubs]   = useState([])

  // Checker state
  const [selectedGoal, setSelectedGoal] = useState('')
  const [checkResult, setCheckResult]   = useState(null)

  // Schedule state
  const [schedule, setSchedule]   = useState(null)
  const [preferences, setPreferences] = useState('')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const todayStr = new Date().toISOString().split('T')[0]
    const [g, t, a, l] = await Promise.all([
      supabase.from('goals').select('*').eq('user_id', user.id).eq('status', 'active'),
      supabase.from('tasks').select('*').eq('user_id', user.id).eq('due_date', todayStr).neq('status', 'done'),
      supabase.from('availability_slots').select('*').eq('user_id', user.id),
      supabase.from('time_logs').select('*').eq('user_id', user.id)
        .gte('started_at', new Date(Date.now() - 14 * 86400000).toISOString()),
    ])
    setGoals(g.data || [])
    setTasks(t.data || [])
    setAvail(a.data || [])
    setLogs(l.data || [])
  }

  // ── Breakdown ──
  async function handleBreakdown() {
    if (!taskInput.trim()) return
    setLoading(true); setBreakdown(null)
    try {
      const result = await smartTaskBreakdown({ taskTitle: taskInput, availableSlots: avail, existingTasks: tasks })
      setBreakdown(result)
    } catch { alert('تعذّر التحليل') }
    setLoading(false)
  }

  async function addSubtask(sub, index) {
    const todayStr = new Date().toISOString().split('T')[0]
    await supabase.from('tasks').insert({
      user_id: user.id, title: sub.title, priority: 'medium',
      due_date: todayStr, status: 'pending',
    })
    setAddedSubs(prev => [...prev, index])
  }

  async function addAllSubtasks() {
    const todayStr = new Date().toISOString().split('T')[0]
    for (const sub of breakdown.subtasks) {
      await supabase.from('tasks').insert({
        user_id: user.id, title: sub.title, priority: 'medium',
        due_date: todayStr, status: 'pending',
      })
    }
    setAddedSubs(breakdown.subtasks.map((_, i) => i))
  }

  // ── Checker ──
  async function handleCheck() {
    if (!selectedGoal) return
    setLoading(true); setCheckResult(null)
    const goal = goals.find(g => g.id === selectedGoal)
    try {
      const result = await checkGoalTimeSufficiency({ goal, timeLogs: logs, availableSlots: avail })
      setCheckResult(result)
    } catch { alert('تعذّر التحليل') }
    setLoading(false)
  }

  // ── Schedule ──
  async function handleSchedule() {
    setLoading(true); setSchedule(null)
    try {
      const result = await buildDailySchedule({ tasks, availableSlots: avail, timeLogs: logs, preferences })
      setSchedule(result)
    } catch { alert('تعذّر بناء الجدول') }
    setLoading(false)
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>المخطط الذكي 🧠</h1>
        <p style={{ fontSize: 13, color: '#475569', margin: '4px 0 0' }}>AI يساعدك تخطط يومك بشكل أذكى</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {TABS.map(({ key, icon: Icon, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 10, fontSize: 13, cursor: 'pointer',
            border: `1px solid ${tab === key ? '#f59e0b' : '#2a3040'}`,
            background: tab === key ? 'rgba(245,158,11,0.1)' : '#13161d',
            color: tab === key ? '#f59e0b' : '#475569',
            transition: 'all 0.15s',
          }}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* ══ TAB 1: TASK BREAKDOWN ══ */}
      {tab === 'breakdown' && (
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Brain size={16} color="#a855f7" />
              <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>تقسيم المهمة الكبيرة</h3>
              <span className="badge badge-purple" style={{ fontSize: 11 }}>AI</span>
            </div>
            <p style={{ fontSize: 13, color: '#475569', marginBottom: 14 }}>
              اكتب مهمة كبيرة وسيقسّمها AI لخطوات صغيرة ويوزّعها على وقتك المتاح اليوم
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                className="input" style={{ flex: 1 }}
                placeholder='مثال: "أذاكر الفصل الخامس في الكيمياء" أو "أخلّص التقرير الشهري"'
                value={taskInput}
                onChange={e => setTaskInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleBreakdown()}
              />
              <button className="btn-primary" onClick={handleBreakdown} disabled={loading || !taskInput.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                <Sparkles size={13} />{loading ? 'جاري التقسيم...' : 'قسّم المهمة'}
              </button>
            </div>
            {avail.length === 0 && (
              <p style={{ fontSize: 12, color: '#f59e0b', marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertCircle size={12} /> أضف أوقات فراغك أولاً من صفحة "وقت الفراغ" لتحسين التوزيع
              </p>
            )}
          </div>

          {/* Breakdown result */}
          {breakdown && (
            <div className="card fade-in">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>"{taskInput}"</h3>
                  <p style={{ fontSize: 12, color: '#475569', margin: '4px 0 0' }}>{breakdown.summary}</p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#475569' }}>{breakdown.total_minutes} دقيقة</span>
                  <span className={`badge ${breakdown.feasible ? 'badge-green' : 'badge-red'}`}>
                    {breakdown.feasible ? '✓ ممكن اليوم' : '⚠ يحتاج أكثر من يوم'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {breakdown.subtasks.map((sub, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: '#13161d', borderRadius: 10, padding: '12px 14px',
                    border: `1px solid ${addedSubs.includes(i) ? '#22c55e33' : '#2a3040'}`,
                  }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                      background: addedSubs.includes(i) ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.12)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, color: addedSubs.includes(i) ? '#22c55e' : '#f59e0b',
                    }}>
                      {addedSubs.includes(i) ? '✓' : i + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, color: addedSubs.includes(i) ? '#475569' : '#e2e8f0', margin: 0, fontWeight: 500 }}>{sub.title}</p>
                      <p style={{ fontSize: 11, color: '#475569', margin: '3px 0 0' }}>💡 {sub.tip}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={11} />{sub.duration_minutes}د
                      </span>
                      {!addedSubs.includes(i) && (
                        <button onClick={() => addSubtask(sub, i)} style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                          borderRadius: 6, padding: '4px 10px', color: '#f59e0b',
                          fontSize: 11, cursor: 'pointer',
                        }}>
                          <Plus size={10} /> أضف
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {addedSubs.length < breakdown.subtasks.length && (
                <button className="btn-primary" onClick={addAllSubtasks} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Plus size={13} /> أضف كل الخطوات لمهام اليوم
                </button>
              )}
              {addedSubs.length === breakdown.subtasks.length && (
                <div style={{ textAlign: 'center', padding: '10px 0', color: '#22c55e', fontSize: 13 }}>
                  ✅ تمت إضافة كل الخطوات — روح صفحة "مهامي" تشوفها!
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══ TAB 2: GOAL CHECKER ══ */}
      {tab === 'checker' && (
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Target size={16} color="#3b82f6" />
              <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>هل وقتك كافي؟</h3>
              <span className="badge" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', fontSize: 11 }}>AI</span>
            </div>
            <p style={{ fontSize: 13, color: '#475569', marginBottom: 16 }}>
              يحسب AI متوسط وقتك اليومي على الهدف ويقارنه بالمطلوب لتحقيقه في الوقت المحدد
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <select className="input" style={{ flex: 1 }} value={selectedGoal} onChange={e => { setSelectedGoal(e.target.value); setCheckResult(null) }}>
                <option value="">اختر هدف تحللّه</option>
                {goals.map(g => <option key={g.id} value={g.id}>{g.title} ({g.progress}%)</option>)}
              </select>
              <button className="btn-primary" onClick={handleCheck} disabled={loading || !selectedGoal}
                style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                <Zap size={13} />{loading ? 'جاري التحليل...' : 'حلّل الهدف'}
              </button>
            </div>
          </div>

          {checkResult && (() => {
            const goal = goals.find(g => g.id === selectedGoal)
            const riskColor = { low: '#22c55e', medium: '#f59e0b', high: '#ef4444' }[checkResult.risk_level] || '#94a3b8'
            const riskLabel = { low: 'منخفض', medium: 'متوسط', high: 'عالي' }[checkResult.risk_level] || '—'
            return (
              <div className="card fade-in">
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>{goal?.title}</h3>
                    <p style={{ fontSize: 12, color: '#475569', margin: '4px 0 0' }}>التقدم الحالي: {goal?.progress}%</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span className={`badge ${checkResult.sufficient ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 12, padding: '5px 12px' }}>
                      {checkResult.sufficient ? '✓ الوقت كافي' : '⚠ الوقت غير كافي'}
                    </span>
                  </div>
                </div>

                {/* Stats grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                  {[
                    { label: 'وقتك اليومي الفعلي', value: `${checkResult.avg_daily_actual} د`, color: '#3b82f6' },
                    { label: 'المطلوب يومياً', value: `${checkResult.avg_daily_needed} د`, color: '#f59e0b' },
                    { label: 'الفجوة اليومية', value: `${checkResult.gap_minutes > 0 ? '+' : ''}${checkResult.gap_minutes} د`, color: checkResult.gap_minutes <= 0 ? '#22c55e' : '#ef4444' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: '#13161d', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                      <p style={{ fontSize: 22, fontWeight: 700, color, margin: 0 }}>{value}</p>
                      <p style={{ fontSize: 11, color: '#475569', margin: '4px 0 0' }}>{label}</p>
                    </div>
                  ))}
                </div>

                {/* Progress visual */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569', marginBottom: 6 }}>
                    <span>التقدم الحالي</span>
                    <span>بحاجة لـ {checkResult.avg_daily_needed} د/يوم</span>
                  </div>
                  <div style={{ position: 'relative', height: 10, background: '#1e2330', borderRadius: 5 }}>
                    <div style={{ height: '100%', width: `${goal?.progress}%`, background: riskColor, borderRadius: 5, transition: 'width 0.5s' }} />
                    {checkResult.avg_daily_actual > 0 && (
                      <div style={{
                        position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                        left: `${Math.min((checkResult.avg_daily_actual / checkResult.avg_daily_needed) * 100, 100)}%`,
                        width: 2, height: 18, background: '#3b82f6', borderRadius: 1,
                      }} />
                    )}
                  </div>
                </div>

                {/* Risk + deadline */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div style={{ background: '#13161d', borderRadius: 10, padding: 14 }}>
                    <p style={{ fontSize: 11, color: '#475569', margin: '0 0 4px' }}>مستوى الخطر</p>
                    <p style={{ fontSize: 16, fontWeight: 700, color: riskColor, margin: 0 }}>{riskLabel}</p>
                  </div>
                  <div style={{ background: '#13161d', borderRadius: 10, padding: 14 }}>
                    <p style={{ fontSize: 11, color: '#475569', margin: '0 0 4px' }}>موعد الإنجاز المتوقع</p>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
                      {checkResult.adjusted_deadline || `${checkResult.weeks_to_complete} أسبوع`}
                    </p>
                  </div>
                </div>

                {/* Verdict & recommendation */}
                <div style={{ background: `${riskColor}10`, border: `1px solid ${riskColor}30`, borderRadius: 10, padding: 14 }}>
                  <p style={{ fontSize: 13, color: riskColor, fontWeight: 600, margin: '0 0 6px' }}>{checkResult.verdict}</p>
                  <p style={{ fontSize: 13, color: '#94a3b8', margin: 0, lineHeight: 1.6 }}>💡 {checkResult.recommendation}</p>
                </div>
              </div>
            )
          })()}

          {goals.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <Target size={32} color="#2a3040" style={{ display: 'block', margin: '0 auto 10px' }} />
              <p style={{ color: '#475569', fontSize: 13 }}>أضف أهدافاً أولاً من صفحة "أهدافي"</p>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB 3: DAILY SCHEDULE ══ */}
      {tab === 'schedule' && (
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Calendar size={16} color="#22c55e" />
              <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>جدول ساعي مثالي لليوم</h3>
              <span className="badge badge-green" style={{ fontSize: 11 }}>AI</span>
            </div>
            <p style={{ fontSize: 13, color: '#475569', marginBottom: 14 }}>
              بناءً على مهامك ووقت فراغك وأنماط إنتاجيتك، AI يبني جدولاً مثالياً ساعة بساعة
            </p>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <input className="input" style={{ flex: 1 }} placeholder='تفضيلات إضافية (اختياري) — مثال: "أفضّل المذاكرة في الصباح"'
                value={preferences} onChange={e => setPreferences(e.target.value)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>
                {tasks.length} مهمة اليوم · {avail.length} وقت فراغ
              </p>
              <button className="btn-primary" onClick={handleSchedule} disabled={loading}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={13} />{loading ? 'جاري البناء...' : 'ابنِ جدولي'}
              </button>
            </div>
          </div>

          {tasks.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#f59e0b' }}>
              <AlertCircle size={13} /> أضف مهام لليوم من صفحة "مهامي" لبناء جدول أفضل
            </div>
          )}

          {schedule && (
            <div className="card fade-in">
              {schedule.warning && (
                <div style={{ display: 'flex', gap: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#fca5a5' }}>
                  <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />{schedule.warning}
                </div>
              )}

              <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16, borderBottom: '1px solid #2a3040', paddingBottom: 12 }}>{schedule.summary}</p>

              {/* Timeline */}
              <div style={{ position: 'relative' }}>
                {/* Vertical line */}
                <div style={{ position: 'absolute', right: 19, top: 0, bottom: 0, width: 2, background: '#1e2330' }} />

                {(schedule.schedule || []).map((item, i) => {
                  const color = TYPE_COLORS[item.type] || '#94a3b8'
                  return (
                    <div key={i} style={{ display: 'flex', gap: 16, marginBottom: 16, position: 'relative' }}>
                      {/* Dot */}
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 4, position: 'relative', zIndex: 1, boxShadow: `0 0 0 3px ${color}30` }} />

                      <div style={{ flex: 1, background: '#13161d', borderRadius: 10, padding: '12px 14px', borderRight: `3px solid ${color}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{item.task}</span>
                          <span className="badge" style={{ background: `${color}18`, color, fontSize: 10 }}>
                            {TYPE_LABELS[item.type] || item.type}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 11, color: '#475569', fontFamily: 'JetBrains Mono' }}>
                            {item.time} — {item.end_time}
                          </span>
                          {item.tip && <span style={{ fontSize: 11, color: '#64748b' }}>· {item.tip}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
