import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { generateWeeklyReview } from '../lib/ai'
import { format, subDays } from 'date-fns'
import { ar } from 'date-fns/locale'
import { Sparkles, Trophy, AlertCircle, TrendingUp, RefreshCw, Plus, CheckSquare } from 'lucide-react'

const GRADE_STYLES = {
  'ممتاز':      { color:'#22c55e', bg:'rgba(34,197,94,0.1)' },
  'جيد جداً':   { color:'#3b82f6', bg:'rgba(59,130,246,0.1)' },
  'جيد':        { color:'#f59e0b', bg:'rgba(245,158,11,0.1)' },
  'مقبول':      { color:'#f97316', bg:'rgba(249,115,22,0.1)' },
  'يحتاج تحسين':{ color:'#ef4444', bg:'rgba(239,68,68,0.1)' },
}

export default function WeeklyReview() {
  const { user }          = useAuthStore()
  const [review, setReview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [data, setData]   = useState(null)
  const [addedTasks, setAddedTasks] = useState([])

  const weekStart = format(subDays(new Date(), 6), 'd MMM', { locale: ar })
  const weekEnd   = format(new Date(), 'd MMM yyyy', { locale: ar })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const from = subDays(new Date(), 14).toISOString()
    const [t, l, g, h, hl] = await Promise.all([
      supabase.from('tasks').select('*').eq('user_id',user.id),
      supabase.from('time_logs').select('*').eq('user_id',user.id).gte('started_at',from),
      supabase.from('goals').select('*').eq('user_id',user.id).eq('status','active'),
      supabase.from('habits').select('*').eq('user_id',user.id),
      supabase.from('habit_logs').select('*').eq('user_id',user.id).gte('log_date',subDays(new Date(),7).toISOString().split('T')[0]),
    ])
    setData({ tasks:t.data||[], timeLogs:l.data||[], goals:g.data||[], habits:h.data||[], habitLogs:hl.data||[] })
  }

  async function generateReview() {
    if (!data) return
    setLoading(true); setReview(null)
    try {
      const r = await generateWeeklyReview(data)
      setReview(r)
    } catch { alert('تعذّر إنشاء المراجعة') }
    setLoading(false)
  }

  async function addSuggestedTask(title, i) {
    const nextMon = new Date(); nextMon.setDate(nextMon.getDate() + 1)
    await supabase.from('tasks').insert({ user_id:user.id, title, priority:'medium', due_date:nextMon.toISOString().split('T')[0], status:'pending' })
    setAddedTasks(p => [...p, i])
  }

  const gradeStyle = review ? (GRADE_STYLES[review.grade] || GRADE_STYLES['جيد']) : null

  return (
    <div className="fade-in">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'#e2e8f0', margin:0 }}>المراجعة الأسبوعية 📊</h1>
          <p style={{ fontSize:13, color:'#475569', margin:'4px 0 0' }}>{weekStart} — {weekEnd}</p>
        </div>
        <button onClick={generateReview} disabled={loading} className="btn-primary" style={{ display:'flex', alignItems:'center', gap:6 }}>
          <Sparkles size={13} />{loading?'جاري التحليل...':'ابدأ المراجعة'}
        </button>
      </div>

      {!review && !loading && (
        <div className="card" style={{ textAlign:'center', padding:56, background:'linear-gradient(135deg,rgba(245,158,11,0.04),rgba(168,85,247,0.04))', borderColor:'#f59e0b22' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>📊</div>
          <h3 style={{ fontSize:16, color:'#e2e8f0', marginBottom:8 }}>وقت المراجعة الأسبوعية!</h3>
          <p style={{ fontSize:13, color:'#475569', maxWidth:400, margin:'0 auto 24px', lineHeight:1.7 }}>
            Claude سيحلل أسبوعك كاملاً — إنجازاتك، الفرص الضائعة، أنماطك، وخطة الأسبوع الجاي
          </p>
          <button onClick={generateReview} className="btn-primary" style={{ fontSize:14, padding:'12px 28px' }}>
            🚀 ابدأ مراجعة أسبوعي
          </button>
        </div>
      )}

      {loading && (
        <div className="card" style={{ textAlign:'center', padding:56 }}>
          <div style={{ fontSize:40, marginBottom:12, animation:'spin 2s linear infinite', display:'inline-block' }}>⚙️</div>
          <p style={{ color:'#94a3b8', fontSize:14 }}>Claude يحلل أسبوعك...</p>
          <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {review && (
        <div className="fade-in">
          {/* Score & Grade */}
          <div className="card" style={{ marginBottom:20, textAlign:'center', background:gradeStyle?.bg, borderColor:gradeStyle?.color+'44' }}>
            <p style={{ fontSize:13, color:'#475569', margin:'0 0 8px' }}>نقطة الأسبوع</p>
            <div style={{ fontSize:64, fontWeight:800, color:gradeStyle?.color, fontFamily:'JetBrains Mono', lineHeight:1 }}>{review.score}</div>
            <div style={{ fontSize:11, color:gradeStyle?.color, marginTop:4, marginBottom:12 }}>/ 100</div>
            <span style={{ fontSize:16, fontWeight:600, color:gradeStyle?.color, background:gradeStyle?.color+'20', padding:'6px 16px', borderRadius:20 }}>
              {review.grade}
            </span>
            <p style={{ fontSize:13, color:'#94a3b8', margin:'16px 0 0', fontStyle:'italic' }}>"{review.motivation}"</p>
          </div>

          {/* Wins & Misses */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
            <div className="card" style={{ borderColor:'#22c55e33' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                <Trophy size={14} color="#22c55e" />
                <h3 style={{ fontSize:13, fontWeight:600, color:'#22c55e', margin:0 }}>إنجازات الأسبوع</h3>
              </div>
              {review.wins.map((win, i) => (
                <div key={i} style={{ display:'flex', gap:8, marginBottom:8, fontSize:13, color:'#94a3b8' }}>
                  <span style={{ color:'#22c55e', flexShrink:0 }}>✓</span>{win}
                </div>
              ))}
            </div>
            <div className="card" style={{ borderColor:'#f59e0b33' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                <AlertCircle size={14} color="#f59e0b" />
                <h3 style={{ fontSize:13, fontWeight:600, color:'#f59e0b', margin:0 }}>فرص للتحسين</h3>
              </div>
              {review.misses.map((miss, i) => (
                <div key={i} style={{ display:'flex', gap:8, marginBottom:8, fontSize:13, color:'#94a3b8' }}>
                  <span style={{ color:'#f59e0b', flexShrink:0 }}>→</span>{miss}
                </div>
              ))}
            </div>
          </div>

          {/* Patterns & Next focus */}
          <div className="card" style={{ marginBottom:20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
              <TrendingUp size={14} color="#a855f7" />
              <h3 style={{ fontSize:13, fontWeight:600, color:'#a855f7', margin:0 }}>أنماط الأسبوع</h3>
            </div>
            <p style={{ fontSize:13, color:'#94a3b8', margin:'0 0 16px', lineHeight:1.7 }}>{review.patterns}</p>
            <div style={{ background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:10, padding:14 }}>
              <p style={{ fontSize:12, color:'#f59e0b', fontWeight:600, margin:'0 0 4px' }}>🎯 تركيز الأسبوع الجاي</p>
              <p style={{ fontSize:13, color:'#cbd5e1', margin:0, lineHeight:1.6 }}>{review.next_week_focus}</p>
            </div>
          </div>

          {/* Next week tasks */}
          <div className="card">
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
              <CheckSquare size={14} color="#3b82f6" />
              <h3 style={{ fontSize:13, fontWeight:600, color:'#e2e8f0', margin:0 }}>مهام مقترحة للأسبوع الجاي</h3>
            </div>
            {review.next_week_tasks.map((task, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid #1e2330' }}>
                <span style={{ fontSize:13, color:addedTasks.includes(i)?'#475569':'#e2e8f0', flex:1, textDecoration:addedTasks.includes(i)?'line-through':'none' }}>{task}</span>
                {!addedTasks.includes(i) ? (
                  <button onClick={() => addSuggestedTask(task, i)} style={{ display:'flex', alignItems:'center', gap:4, background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.3)', borderRadius:6, padding:'4px 10px', color:'#3b82f6', fontSize:11, cursor:'pointer' }}>
                    <Plus size={10} /> أضف
                  </button>
                ) : <span style={{ fontSize:11, color:'#22c55e' }}>✓ أُضيفت</span>}
              </div>
            ))}
            <button onClick={generateReview} disabled={loading} className="btn-ghost" style={{ width:'100%', marginTop:14, display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontSize:12 }}>
              <RefreshCw size={12} /> مراجعة مجدداً
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
