import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { Plus, Flag, CheckCircle, Trash2, Trophy } from 'lucide-react'

export default function Milestones() {
  const { user } = useAuthStore()
  const [goals, setGoals]       = useState([])
  const [milestones, setMilestones] = useState([])
  const [loading, setLoading]   = useState(true)
  const [form, setForm]         = useState({ goal_id:'', title:'', target_date:'' })
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [celebrating, setCelebrating] = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [gR, mR] = await Promise.all([
      supabase.from('goals').select('id,title,category').eq('user_id', user.id).eq('status','active'),
      supabase.from('milestones').select('*').eq('user_id', user.id).order('target_date'),
    ])
    setGoals(gR.data || [])
    setMilestones(mR.data || [])
    setLoading(false)
  }

  async function saveMilestone() {
    if (!form.goal_id || !form.title.trim()) return
    setSaving(true)
    await supabase.from('milestones').insert({
      user_id: user.id,
      goal_id: form.goal_id,
      title: form.title.trim(),
      target_date: form.target_date || null,
      completed: false,
    })
    setForm({ goal_id:'', title:'', target_date:'' })
    setShowForm(false); setSaving(false); fetchAll()
  }

  async function toggleMilestone(m) {
    const completed = !m.completed
    await supabase.from('milestones').update({ completed, completed_at: completed ? new Date().toISOString() : null }).eq('id', m.id)
    if (completed) {
      setCelebrating(m.id)
      setTimeout(() => setCelebrating(null), 3000)
    }
    setMilestones(prev => prev.map(x => x.id===m.id ? { ...x, completed, completed_at: completed ? new Date().toISOString() : null } : x))
  }

  async function deleteMilestone(id) {
    await supabase.from('milestones').delete().eq('id', id)
    setMilestones(prev => prev.filter(m => m.id !== id))
  }

  // Group by goal
  const byGoal = goals.map(g => ({
    goal: g,
    items: milestones.filter(m => m.goal_id === g.id),
  })).filter(g => g.items.length > 0)

  const unassigned = { goal: null, items: milestones.filter(m => !goals.find(g => g.id === m.goal_id)) }
  const allGroups  = [...byGoal, ...(unassigned.items.length ? [unassigned] : [])]

  return (
    <div className="fade-in">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28 }}>
        <div>
          <h1 className="page-title">المراحل والإنجازات 🏆</h1>
          <p className="page-subtitle">قسّم أهدافك لمراحل احتفل بكل منها</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={14} /> مرحلة جديدة
        </button>
      </div>

      {showForm && (
        <div className="card card-gold fade-in" style={{ marginBottom:24 }}>
          <h3 style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)', marginBottom:16, marginTop:0 }}>مرحلة جديدة</h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
            <div>
              <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:6 }}>الهدف المرتبط *</label>
              <select className="input" value={form.goal_id} onChange={e => setForm(p => ({ ...p, goal_id:e.target.value }))}>
                <option value="">اختر هدفاً...</option>
                {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:6 }}>التاريخ المستهدف</label>
              <input className="input" type="date" value={form.target_date} onChange={e => setForm(p => ({ ...p, target_date:e.target.value }))} />
            </div>
            <div style={{ gridColumn:'span 2' }}>
              <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:6 }}>اسم المرحلة *</label>
              <input className="input" placeholder="مثال: إنهاء الفصل الأول" value={form.title}
                onChange={e => setForm(p => ({ ...p, title:e.target.value }))} onKeyDown={e => e.key==='Enter'&&saveMilestone()} />
            </div>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button className="btn-primary" onClick={saveMilestone} disabled={saving}>{saving?'...':'حفظ المرحلة'}</button>
            <button className="btn-ghost" onClick={() => setShowForm(false)}>إلغاء</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="empty-state"><div className="spinner" /></div>
      ) : allGroups.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🏁</span>
          <p>أضف مراحل لأهدافك واحتفل بكل إنجاز</p>
          <button className="btn-primary" onClick={() => setShowForm(true)}>أضف أول مرحلة</button>
        </div>
      ) : allGroups.map(({ goal, items }) => (
        <div key={goal?.id || 'unassigned'} className="card" style={{ marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
            <Flag size={14} color="var(--gold)" />
            <span style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)' }}>
              {goal ? goal.title : 'بدون هدف'}
            </span>
            <span style={{ fontSize:11, color:'var(--text-muted)', marginRight:'auto' }}>
              {items.filter(i=>i.completed).length}/{items.length} مكتمل
            </span>
          </div>

          {/* Progress track */}
          <div style={{ display:'flex', alignItems:'center', gap:0, marginBottom:16, overflowX:'auto', paddingBottom:4 }}>
            {items.map((m, idx) => (
              <div key={m.id} style={{ display:'flex', alignItems:'center', flexShrink:0 }}>
                <div style={{ textAlign:'center', width:80 }}>
                  <button onClick={() => toggleMilestone(m)} style={{
                    width:36, height:36, borderRadius:'50%',
                    background: m.completed ? 'var(--green)' : celebrating === m.id ? 'var(--gold)' : 'var(--bg-overlay)',
                    border: `2px solid ${m.completed ? 'var(--green)' : 'var(--border-default)'}`,
                    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                    transition:'all 0.3s', margin:'0 auto 6px',
                    boxShadow: celebrating===m.id ? '0 0 20px rgba(240,165,0,0.6)' : 'none',
                  }}>
                    {m.completed ? <CheckCircle size={16} color="#07091a" /> : <span style={{ fontSize:12, color:'var(--text-muted)' }}>{idx+1}</span>}
                  </button>
                  <p style={{ fontSize:10, color: m.completed ? 'var(--green)' : 'var(--text-muted)', margin:0, lineHeight:1.3, wordBreak:'break-word' }}>{m.title}</p>
                  {m.target_date && <p style={{ fontSize:9, color:'var(--text-muted)', margin:'2px 0 0', fontFamily:'var(--font-mono)' }}>{m.target_date}</p>}
                </div>
                {idx < items.length - 1 && (
                  <div style={{ width:24, height:2, background: m.completed ? 'var(--green)' : 'var(--border-subtle)', flexShrink:0, transition:'background 0.3s' }} />
                )}
              </div>
            ))}
          </div>

          {/* List */}
          {items.map(m => (
            <div key={m.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderTop:'1px solid var(--border-subtle)' }}>
              {celebrating === m.id && <span style={{ fontSize:18 }}>🎉</span>}
              <span style={{ fontSize:12, flex:1, color: m.completed ? 'var(--text-muted)' : 'var(--text-secondary)', textDecoration: m.completed ? 'line-through' : 'none' }}>{m.title}</span>
              {m.completed && m.completed_at && (
                <span style={{ fontSize:10, color:'var(--green)' }}>✓ {new Date(m.completed_at).toLocaleDateString('ar-EG')}</span>
              )}
              <button onClick={() => deleteMilestone(m.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4, transition:'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color='var(--red)'}
                onMouseLeave={e => e.currentTarget.style.color='var(--text-muted)'}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
