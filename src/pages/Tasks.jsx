import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { rescheduleOverdueTasks } from '../lib/ai'
import { Plus, Trash2, CheckSquare, Sparkles } from 'lucide-react'

const PRIORITIES = [
  { value: 'high', label: 'عالية', cls: 'badge-red' },
  { value: 'medium', label: 'متوسطة', cls: 'badge-amber' },
  { value: 'low', label: 'منخفضة', cls: 'badge-green' },
]
const FILTERS = ['الكل', 'اليوم', 'هذا الأسبوع', 'منجز', 'متأخر']

export default function Tasks() {
  const { user } = useAuthStore()
  const [tasks, setTasks] = useState([])
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('الكل')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', priority: 'medium', due_date: todayStr(), goal_id: '', recurrence: 'none' })
  const [saving, setSaving] = useState(false)
  const [rescheduling, setRescheduling] = useState(false)
  const [rescheduleResult, setRescheduleResult] = useState(null)

  useEffect(() => { fetchData() }, [])

  function todayStr() { return new Date().toISOString().split('T')[0] }
  function weekEndStr() { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().split('T')[0] }

  async function fetchData() {
    setLoading(true)
    const [tasksRes, goalsRes] = await Promise.all([
      supabase.from('tasks').select('*').eq('user_id', user.id).order('due_date').order('priority'),
      supabase.from('goals').select('id, title').eq('user_id', user.id).eq('status', 'active'),
    ])
    setTasks(tasksRes.data || [])
    setGoals(goalsRes.data || [])
    setLoading(false)
  }

  function filteredTasks() {
    const today = todayStr(), weekEnd = weekEndStr()
    switch (filter) {
      case 'اليوم': return tasks.filter(t => t.due_date === today && t.status !== 'done')
      case 'هذا الأسبوع': return tasks.filter(t => t.due_date >= today && t.due_date <= weekEnd && t.status !== 'done')
      case 'منجز': return tasks.filter(t => t.status === 'done')
      case 'متأخر': return tasks.filter(t => t.due_date < today && t.status !== 'done')
      default: return tasks
    }
  }

  async function saveTask() {
    if (!form.title.trim()) return
    setSaving(true)
    await supabase.from('tasks').insert({ user_id: user.id, title: form.title.trim(), priority: form.priority, due_date: form.due_date, goal_id: form.goal_id || null, status: 'pending', recurrence: form.recurrence || 'none' })
    setForm({ title: '', priority: 'medium', due_date: todayStr(), goal_id: '' })
    setShowForm(false); setSaving(false); fetchData()
  }

  async function toggleTask(task) {
    const newStatus = task.status === 'done' ? 'pending' : 'done'
    await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))

    // إنشاء المهمة التالية لو متكررة
    if (newStatus === 'done' && task.recurrence && task.recurrence !== 'none' && task.due_date) {
      const next = new Date(task.due_date)
      if (task.recurrence === 'daily')   next.setDate(next.getDate() + 1)
      if (task.recurrence === 'weekly')  next.setDate(next.getDate() + 7)
      if (task.recurrence === 'monthly') next.setMonth(next.getMonth() + 1)
      const nextDate = next.toISOString().split('T')[0]
      // تأكد مش موجودة بالفعل
      const exists = tasks.some(t => t.title === task.title && t.due_date === nextDate)
      if (!exists) {
        const { data: newTask } = await supabase.from('tasks').insert({
          user_id: user.id, title: task.title, priority: task.priority,
          due_date: nextDate, goal_id: task.goal_id, status: 'pending',
          recurrence: task.recurrence,
        }).select().single()
        if (newTask) setTasks(prev => [...prev, newTask])
      }
    }
  }

  async function deleteTask(id) {
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  async function handleReschedule() {
    const overdue = tasks.filter(t => t.due_date < todayStr() && t.status !== 'done')
    if (!overdue.length) return alert('لا توجد مهام متأخرة!')
    setRescheduling(true); setRescheduleResult(null)
    try { const r = await rescheduleOverdueTasks(overdue, []); setRescheduleResult(r.rescheduled || []) }
    catch { alert('حدث خطأ في إعادة الجدولة') }
    setRescheduling(false)
  }

  async function applyReschedule(item) {
    const task = tasks.find(t => t.title === item.title)
    if (!task) return
    await supabase.from('tasks').update({ due_date: item.new_date }).eq('id', task.id)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, due_date: item.new_date } : t))
    setRescheduleResult(prev => prev.filter(r => r.title !== item.title))
  }

  const overdueCount = tasks.filter(t => t.due_date < todayStr() && t.status !== 'done').length
  const shown = filteredTasks()

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>مهامي ✅</h1>
          <p style={{ fontSize: 13, color: '#475569', margin: '4px 0 0' }}>
            {tasks.filter(t => t.status !== 'done').length} مهمة قيد التنفيذ
            {overdueCount > 0 && <span style={{ color: '#ef4444', marginRight: 8 }}>• {overdueCount} متأخرة</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {overdueCount > 0 && (
            <button onClick={handleReschedule} disabled={rescheduling} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}>
              <Sparkles size={13} />{rescheduling ? 'جاري الجدولة...' : 'أعد جدولة المتأخرة'}
            </button>
          )}
          <button className="btn-primary" onClick={() => setShowForm(!showForm)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> مهمة جديدة
          </button>
        </div>
      </div>

      {rescheduleResult && rescheduleResult.length > 0 && (
        <div className="card fade-in" style={{ marginBottom: 20, borderColor: '#a855f733', background: 'rgba(168,85,247,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Sparkles size={14} color="#a855f7" />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#a855f7' }}>اقتراحات إعادة الجدولة</span>
          </div>
          {rescheduleResult.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #2a3040' }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, color: '#e2e8f0', margin: 0 }}>{item.title}</p>
                <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>→ {item.new_date} · {item.reason}</p>
              </div>
              <button onClick={() => applyReschedule(item)} className="btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}>تطبيق</button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="card fade-in" style={{ marginBottom: 20, borderColor: '#f59e0b44' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div style={{ gridColumn: 'span 3' }}>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>عنوان المهمة *</label>
              <input className="input" placeholder="ماذا تريد أن تفعل؟" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} onKeyDown={e => e.key === 'Enter' && saveTask()} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>تاريخ الاستحقاق</label>
              <input className="input" type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>الأولوية</label>
              <select className="input" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>مرتبط بهدف</label>
              <select className="input" value={form.goal_id} onChange={e => setForm(p => ({ ...p, goal_id: e.target.value }))}>
                <option value="">بدون هدف</option>
                {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>التكرار</label>
              <select className="input" value={form.recurrence} onChange={e => setForm(p => ({ ...p, recurrence: e.target.value }))}>
                <option value="none">بدون تكرار</option>
                <option value="daily">يومياً</option>
                <option value="weekly">أسبوعياً</option>
                <option value="monthly">شهرياً</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-primary" onClick={saveTask} disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ المهمة'}</button>
            <button className="btn-ghost" onClick={() => setShowForm(false)}>إلغاء</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 16px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: `1px solid ${filter === f ? '#f59e0b' : '#2a3040'}`, background: filter === f ? 'rgba(245,158,11,0.1)' : 'transparent', color: filter === f ? '#f59e0b' : '#475569', transition: 'all 0.15s' }}>
            {f}{f === 'متأخر' && overdueCount > 0 && <span style={{ marginRight: 5, background: '#ef4444', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>{overdueCount}</span>}
          </button>
        ))}
      </div>

      {loading ? <p style={{ color: '#475569', fontSize: 13 }}>جاري التحميل...</p> : shown.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <CheckSquare size={36} color="#2a3040" style={{ marginBottom: 12 }} />
          <p style={{ color: '#475569' }}>لا توجد مهام في هذا القسم</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {shown.map(task => {
            const isOverdue = task.due_date < todayStr() && task.status !== 'done'
            return (
              <div key={task.id} className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, borderColor: isOverdue ? '#ef444433' : undefined }}>
                <button onClick={() => toggleTask(task)} style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0, border: `2px solid ${task.status === 'done' ? '#22c55e' : isOverdue ? '#ef4444' : '#2a3040'}`, background: task.status === 'done' ? '#22c55e' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {task.status === 'done' && <span style={{ color: '#0d0f14', fontSize: 11 }}>✓</span>}
                </button>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, color: task.status === 'done' ? '#475569' : isOverdue ? '#fca5a5' : '#e2e8f0', textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>{task.title}</span>
                  {task.due_date && <span style={{ fontSize: 11, color: isOverdue ? '#ef4444' : '#475569', display: 'block', marginTop: 2 }}>{isOverdue ? '⚠️ ' : '📅 '}{task.due_date}</span>}
                </div>
                {task.recurrence && task.recurrence !== 'none' && (
                  <span style={{ fontSize:10, color:'var(--purple)', background:'rgba(155,114,245,0.1)', border:'1px solid rgba(155,114,245,0.2)', borderRadius:20, padding:'2px 8px' }}>
                    {task.recurrence==='daily'?'🔄 يومي':task.recurrence==='weekly'?'🔄 أسبوعي':'🔄 شهري'}
                  </span>
                )}
                <span className={`badge ${PRIORITIES.find(p => p.value === task.priority)?.cls}`}>{PRIORITIES.find(p => p.value === task.priority)?.label}</span>
                <button onClick={() => deleteTask(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2a3040', padding: 4 }} onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = '#2a3040'}>
                  <Trash2 size={13} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
