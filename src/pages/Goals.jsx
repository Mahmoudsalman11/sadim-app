import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { checkGoalTimeSufficiency } from '../lib/ai'
import { Plus, Target, Trash2, Calendar, Zap, Clock, CheckSquare, ChevronDown, ChevronUp, Trophy } from 'lucide-react'
import { differenceInDays } from 'date-fns'

const CATEGORIES = [
  { value:'study',   label:'دراسة',  color:'#4f9cf9' },
  { value:'health',  label:'صحة',    color:'#2dd4aa' },
  { value:'career',  label:'مهنة',   color:'#f0a500' },
  { value:'hobby',   label:'هواية',  color:'#9b72f5' },
  { value:'finance', label:'مالية',  color:'#22d3ee' },
  { value:'other',   label:'أخرى',   color:'#4a5270' },
]
const PRIORITIES = [
  { value:'high',   label:'عالية' },
  { value:'medium', label:'متوسطة' },
  { value:'low',    label:'منخفضة' },
]

// حساب التقدم تلقائياً من المهام المنجزة + الوقت المسجل
function calcAutoProgress(goal, tasks, timeLogs) {
  const goalTasks   = tasks.filter(t => t.goal_id === goal.id)
  const doneTasks   = goalTasks.filter(t => t.status === 'done').length
  const taskScore   = goalTasks.length > 0 ? (doneTasks / goalTasks.length) * 60 : 0

  const goalLogs    = timeLogs.filter(l => l.goal_id === goal.id || l.note?.toLowerCase().includes(goal.title?.toLowerCase()))
  const totalMins   = goalLogs.filter(l => l.ended_at).reduce((a, l) =>
    a + Math.round((new Date(l.ended_at) - new Date(l.started_at)) / 60000), 0)
  const timeScore   = Math.min((totalMins / 600) * 40, 40) // 600 دقيقة = 100%

  return Math.min(Math.round(taskScore + timeScore), 100)
}

export default function Goals() {
  const { user }        = useAuthStore()
  const [goals, setGoals]   = useState([])
  const [tasks, setTasks]   = useState([])
  const [timeLogs, setTimeLogs] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]     = useState({ title:'', description:'', category:'study', priority:'medium', deadline:'', weekly_hours:'' })
  const [saving, setSaving] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState({})
  const [expandedGoal, setExpandedGoal] = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const from = new Date(Date.now() - 90*86400000).toISOString()
    const [gR, tR, lR, aR] = await Promise.all([
      supabase.from('goals').select('*').eq('user_id', user.id).order('created_at', { ascending:false }),
      supabase.from('tasks').select('*').eq('user_id', user.id),
      supabase.from('time_logs').select('*').eq('user_id', user.id).gte('started_at', from),
      supabase.from('availability_slots').select('*').eq('user_id', user.id),
    ])
    const goals    = gR.data || []
    const tasks    = tR.data || []
    const timeLogs = lR.data || []
    const avail    = aR.data || []

    // حدّث التقدم تلقائياً في DB
    for (const goal of goals) {
      const auto = calcAutoProgress(goal, tasks, timeLogs)
      if (Math.abs(auto - (goal.progress || 0)) >= 2) {
        await supabase.from('goals').update({ progress: auto }).eq('id', goal.id)
        goal.progress = auto
      }
    }

    setGoals(goals); setTasks(tasks); setTimeLogs(timeLogs)
    setLoading(false)
  }

  async function saveGoal() {
    if (!form.title.trim()) return
    setSaving(true)
    await supabase.from('goals').insert({
      user_id: user.id,
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      priority: form.priority,
      deadline: form.deadline || null,
      weekly_hours_target: form.weekly_hours ? Number(form.weekly_hours) : null,
      status: 'active',
      progress: 0,
    })
    setForm({ title:'', description:'', category:'study', priority:'medium', deadline:'', weekly_hours:'' })
    setShowForm(false); setSaving(false); fetchAll()
  }

  async function deleteGoal(id) {
    if (!confirm('هل تريد حذف هذا الهدف؟')) return
    await supabase.from('goals').delete().eq('id', id)
    setGoals(prev => prev.filter(g => g.id !== id))
  }

  async function markComplete(id) {
    await supabase.from('goals').update({ status:'completed', progress:100 }).eq('id', id)
    fetchAll()
  }

  async function analyzeGoal(goal) {
    if (aiAnalysis[goal.id]) { setExpandedGoal(g => g === goal.id ? null : goal.id); return }
    setExpandedGoal(goal.id)
    const avail = []
    try {
      const r = await checkGoalTimeSufficiency({ goal, timeLogs, availableSlots: avail })
      setAiAnalysis(prev => ({ ...prev, [goal.id]: r }))
    } catch { setAiAnalysis(prev => ({ ...prev, [goal.id]: null })) }
  }

  const active    = goals.filter(g => g.status === 'active')
  const completed = goals.filter(g => g.status === 'completed')

  return (
    <div className="fade-in">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28 }}>
        <div>
          <h1 className="page-title">أهدافي 🎯</h1>
          <p className="page-subtitle">{active.length} هدف نشط — التقدم يُحسب تلقائياً من مهامك ووقتك</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={14}/> هدف جديد
        </button>
      </div>

      {showForm && (
        <div className="card card-gold fade-in" style={{ marginBottom:24 }}>
          <h3 style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)', marginBottom:16, marginTop:0 }}>هدف جديد</h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            <div style={{ gridColumn:'span 2' }}>
              <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' }}>اسم الهدف *</label>
              <input className="input" placeholder="مثال: إتقان لغة Python" value={form.title}
                onChange={e => setForm(p => ({ ...p, title:e.target.value }))} onKeyDown={e => e.key==='Enter'&&saveGoal()} />
            </div>
            <div>
              <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' }}>الموعد النهائي</label>
              <input className="input" type="date" value={form.deadline} onChange={e => setForm(p => ({ ...p, deadline:e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' }}>ساعات أسبوعية مستهدفة</label>
              <input className="input" type="number" min="1" max="40" placeholder="مثال: 5" value={form.weekly_hours}
                onChange={e => setForm(p => ({ ...p, weekly_hours:e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' }}>الفئة</label>
              <select className="input" value={form.category} onChange={e => setForm(p => ({ ...p, category:e.target.value }))}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' }}>الأولوية</label>
              <select className="input" value={form.priority} onChange={e => setForm(p => ({ ...p, priority:e.target.value }))}>
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div style={{ gridColumn:'span 2' }}>
              <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' }}>وصف (اختياري)</label>
              <textarea className="input" rows={2} placeholder="لماذا يهمك هذا الهدف؟"
                value={form.description} onChange={e => setForm(p => ({ ...p, description:e.target.value }))} />
            </div>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button className="btn-primary" onClick={saveGoal} disabled={saving}>{saving ? '...' : 'حفظ الهدف'}</button>
            <button className="btn-ghost" onClick={() => setShowForm(false)}>إلغاء</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="empty-state"><div className="spinner" /></div>
      ) : active.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:48 }}>
          <div className="empty-state">
            <span className="empty-icon">🎯</span>
            <p>لا توجد أهداف نشطة بعد</p>
            <button className="btn-primary" onClick={() => setShowForm(true)}>أضف هدفك الأول</button>
          </div>
        </div>
      ) : (
        <div style={{ display:'grid', gap:14 }}>
          {active.map(goal => {
            const cat        = CATEGORIES.find(c => c.value === goal.category) || CATEGORIES[5]
            const goalTasks  = tasks.filter(t => t.goal_id === goal.id)
            const doneTasks  = goalTasks.filter(t => t.status === 'done').length
            const goalLogs   = timeLogs.filter(l => l.goal_id === goal.id)
            const totalMins  = goalLogs.filter(l => l.ended_at).reduce((a,l) => a + Math.round((new Date(l.ended_at)-new Date(l.started_at))/60000), 0)
            const daysLeft   = goal.deadline ? differenceInDays(new Date(goal.deadline), new Date()) : null
            const analysis   = aiAnalysis[goal.id]
            const isExpanded = expandedGoal === goal.id

            // Time budget this week
            const weekStart  = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay())
            const weekLogs   = goalLogs.filter(l => l.started_at >= weekStart.toISOString() && l.ended_at)
            const weekMins   = weekLogs.reduce((a,l) => a + Math.round((new Date(l.ended_at)-new Date(l.started_at))/60000), 0)
            const weekTarget = (goal.weekly_hours_target || 0) * 60
            const weekPct    = weekTarget > 0 ? Math.min(Math.round((weekMins/weekTarget)*100), 100) : null

            return (
              <div key={goal.id} className="card">
                {/* Header */}
                <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:14 }}>
                  <div style={{ width:10, height:10, borderRadius:'50%', background:cat.color, flexShrink:0, marginTop:5 }} />
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                      <h3 style={{ fontSize:15, fontWeight:600, color:'var(--text-primary)', margin:0 }}>{goal.title}</h3>
                      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                        <span className={`badge badge-${goal.priority==='high'?'red':goal.priority==='medium'?'amber':'green'}`} style={{ fontSize:10 }}>
                          {PRIORITIES.find(p => p.value===goal.priority)?.label}
                        </span>
                        <button onClick={() => markComplete(goal.id)} title="اعتبره منجزاً" style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4, transition:'color 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.color='var(--green)'}
                          onMouseLeave={e => e.currentTarget.style.color='var(--text-muted)'}>
                          <Trophy size={13} />
                        </button>
                        <button onClick={() => deleteGoal(goal.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4, transition:'color 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.color='var(--red)'}
                          onMouseLeave={e => e.currentTarget.style.color='var(--text-muted)'}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    {goal.description && <p style={{ fontSize:12, color:'var(--text-muted)', margin:'0 0 10px' }}>{goal.description}</p>}
                  </div>
                </div>

                {/* Auto-progress bar */}
                <div style={{ marginBottom:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text-muted)', marginBottom:6 }}>
                    <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <Zap size={10} color="var(--gold)" /> تقدم تلقائي
                    </span>
                    <span style={{ color:'var(--gold)', fontWeight:700, fontFamily:'var(--font-mono)' }}>{goal.progress}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width:`${goal.progress}%` }} />
                  </div>
                </div>

                {/* Stats row */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:12 }}>
                  <div style={{ background:'var(--bg-surface)', borderRadius:8, padding:'8px 10px', textAlign:'center' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:4, marginBottom:3 }}>
                      <CheckSquare size={11} color="var(--blue)" />
                      <span style={{ fontSize:9, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>مهام</span>
                    </div>
                    <p style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)', margin:0, fontFamily:'var(--font-mono)' }}>{doneTasks}<span style={{ fontSize:10, color:'var(--text-muted)' }}>/{goalTasks.length}</span></p>
                  </div>
                  <div style={{ background:'var(--bg-surface)', borderRadius:8, padding:'8px 10px', textAlign:'center' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:4, marginBottom:3 }}>
                      <Clock size={11} color="var(--purple)" />
                      <span style={{ fontSize:9, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>وقت</span>
                    </div>
                    <p style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)', margin:0, fontFamily:'var(--font-mono)' }}>
                      {totalMins >= 60 ? `${Math.floor(totalMins/60)}س` : `${totalMins}د`}
                    </p>
                  </div>
                  <div style={{ background:'var(--bg-surface)', borderRadius:8, padding:'8px 10px', textAlign:'center' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:4, marginBottom:3 }}>
                      <Calendar size={11} color={daysLeft !== null && daysLeft < 7 ? 'var(--red)' : 'var(--green)'} />
                      <span style={{ fontSize:9, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>متبقي</span>
                    </div>
                    <p style={{ fontSize:15, fontWeight:700, color: daysLeft !== null && daysLeft < 7 ? 'var(--red)' : 'var(--text-primary)', margin:0, fontFamily:'var(--font-mono)' }}>
                      {daysLeft === null ? '—' : daysLeft <= 0 ? '!' : `${daysLeft}ي`}
                    </p>
                  </div>
                </div>

                {/* Weekly time budget */}
                {weekTarget > 0 && (
                  <div style={{ marginBottom:12 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text-muted)', marginBottom:5 }}>
                      <span>ميزانية هذا الأسبوع</span>
                      <span style={{ fontFamily:'var(--font-mono)', color: weekPct >= 100 ? 'var(--green)' : 'var(--text-secondary)' }}>
                        {Math.floor(weekMins/60)}س {weekMins%60}د / {goal.weekly_hours_target}س ({weekPct}%)
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div style={{ height:'100%', borderRadius:4, transition:'width 0.7s ease', width:`${weekPct}%`,
                        background: weekPct >= 100 ? 'var(--green)' : weekPct >= 60 ? 'var(--gold)' : 'var(--red)' }} />
                    </div>
                  </div>
                )}

                {/* AI Analysis toggle */}
                <button onClick={() => analyzeGoal(goal)} style={{
                  display:'flex', alignItems:'center', gap:6, background:'none', border:'1px solid var(--border-subtle)',
                  borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:11, color:'var(--text-muted)',
                  fontFamily:'var(--font-ar)', transition:'all 0.15s', width:'100%', justifyContent:'center',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor='var(--gold)'; e.currentTarget.style.color='var(--gold)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border-subtle)'; e.currentTarget.style.color='var(--text-muted)' }}>
                  <Zap size={11} />
                  {isExpanded ? 'إخفاء التحليل' : 'تحليل AI — هل وقتك كافي؟'}
                  {isExpanded ? <ChevronUp size={11}/> : <ChevronDown size={11}/>}
                </button>

                {isExpanded && (
                  <div style={{ marginTop:10, padding:12, background:'rgba(240,165,0,0.05)', border:'1px solid rgba(240,165,0,0.12)', borderRadius:10 }}>
                    {!analysis ? (
                      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                        <div className="spinner" style={{ width:14, height:14, borderWidth:2 }} />
                        <span style={{ fontSize:12, color:'var(--text-muted)' }}>جاري التحليل...</span>
                      </div>
                    ) : (
                      <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.8 }}>
                        <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
                          <span style={{ fontSize:20 }}>{analysis.sufficient ? '✅' : '⚠️'}</span>
                          <strong style={{ color: analysis.sufficient ? 'var(--green)' : 'var(--red)', fontSize:13 }}>{analysis.verdict}</strong>
                        </div>
                        <p style={{ margin:'0 0 6px' }}>{analysis.recommendation}</p>
                        {analysis.adjusted_deadline && (
                          <p style={{ margin:0, color:'var(--text-muted)' }}>📅 تاريخ إنجاز متوقع: <strong style={{ color:'var(--gold)' }}>{analysis.adjusted_deadline}</strong></p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Completed goals */}
      {completed.length > 0 && (
        <div style={{ marginTop:28 }}>
          <div className="section-header"><h2>منجز 🏆</h2><div className="section-line" /></div>
          <div style={{ display:'grid', gap:10 }}>
            {completed.map(goal => (
              <div key={goal.id} style={{ background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', borderRadius:12, padding:'12px 16px', display:'flex', alignItems:'center', gap:12, opacity:0.7 }}>
                <Trophy size={14} color="var(--gold)" />
                <span style={{ flex:1, fontSize:13, color:'var(--text-secondary)', textDecoration:'line-through' }}>{goal.title}</span>
                <span className="badge badge-green" style={{ fontSize:10 }}>100%</span>
                <button onClick={() => deleteGoal(goal.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4 }}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
