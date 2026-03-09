import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { detectBurnout } from '../lib/ai'
import { AlertTriangle, CheckCircle, Zap, RefreshCw, Heart } from 'lucide-react'
import { format, subDays, eachDayOfInterval } from 'date-fns'
import { ar } from 'date-fns/locale'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts'

const LEVEL_CONFIG = {
  low:      { label:'بخير تماماً 🟢',       color:'#22c55e', bg:'rgba(34,197,94,0.08)',    icon:'😊', desc:'ممتاز، مستواك متوازن ومستمر' },
  medium:   { label:'تعب خفيف 🟡',          color:'#f59e0b', bg:'rgba(245,158,11,0.08)',   icon:'😐', desc:'في بعض علامات الضغط، انتبه لنفسك' },
  high:     { label:'إرهاق واضح 🔴',         color:'#ef4444', bg:'rgba(239,68,68,0.08)',    icon:'😓', desc:'أنت في حالة إرهاق، خذ استراحة' },
  critical: { label:'إرهاق حاد — استرح! 🆘', color:'#dc2626', bg:'rgba(220,38,38,0.1)',    icon:'🛑', desc:'توقف الآن وخذ يوماً للراحة' },
}

export default function BurnoutDetector() {
  const { user }          = useAuthStore()
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [chartData, setChartData] = useState([])
  const [hasData, setHasData] = useState(false)

  const last14 = eachDayOfInterval({ start:subDays(new Date(),13), end:new Date() })

  useEffect(() => { loadChartData() }, [])

  async function loadChartData() {
    const from = subDays(new Date(), 14).toISOString()
    const { data:logs } = await supabase.from('time_logs').select('*').eq('user_id',user.id).gte('started_at',from)
    const { data:tasks } = await supabase.from('tasks').select('*').eq('user_id',user.id)

    setHasData((logs||[]).filter(l=>l.ended_at).length >= 5)

    const cd = last14.map(d => {
      const ds = format(d,'yyyy-MM-dd')
      const dayLogs = (logs||[]).filter(l=>l.started_at?.startsWith(ds)&&l.ended_at)
      const mins = dayLogs.reduce((a,l)=>a+Math.round((new Date(l.ended_at)-new Date(l.started_at))/60000),0)
      const done = (tasks||[]).filter(t=>t.due_date===ds&&t.status==='done').length
      return { day:format(d,'EEE',{locale:ar}), mins, done, full:ds }
    })
    setChartData(cd)
    // auto-run detection if enough data
    if ((logs||[]).filter(l=>l.ended_at).length >= 5) {
      setTimeout(() => runDetection(), 300)
    }
  }

  async function runDetection() {
    setLoading(true); setResult(null)
    const from = subDays(new Date(), 14).toISOString()
    const [logsRes, tasksRes, habitsRes, habitLogsRes] = await Promise.all([
      supabase.from('time_logs').select('*').eq('user_id',user.id).gte('started_at',from),
      supabase.from('tasks').select('*').eq('user_id',user.id),
      supabase.from('habits').select('*').eq('user_id',user.id),
      supabase.from('habit_logs').select('*').eq('user_id',user.id).gte('log_date',subDays(new Date(),14).toISOString().split('T')[0]),
    ])
    try {
      const r = await detectBurnout({ timeLogs:logsRes.data||[], tasks:tasksRes.data||[], habitLogs:habitLogsRes.data||[], habits:habitsRes.data||[] })
      setResult(r)
    } catch { alert('تعذّر التحليل') }
    setLoading(false)
  }

  const levelConf = result ? (LEVEL_CONFIG[result.burnout_level] || LEVEL_CONFIG.medium) : null

  return (
    <div className="fade-in">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'#e2e8f0', margin:0 }}>كاشف الإرهاق 🔮</h1>
          <p style={{ fontSize:13, color:'#475569', margin:'4px 0 0' }}>AI يراقب أنماطك ويكشف علامات الإرهاق مبكراً</p>
        </div>
        <button onClick={runDetection} disabled={loading||!hasData} className="btn-primary" style={{ display:'flex', alignItems:'center', gap:6 }}>
          <Heart size={13} />{loading?'جاري التحليل...':!hasData?'ابدأ تسجيل الوقت أولاً':'فحص الآن'}
        </button>
      </div>

      {/* Activity charts */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24 }}>
        <div className="card">
          <h3 style={{ fontSize:13, fontWeight:600, color:'#94a3b8', marginBottom:12, marginTop:0 }}>وقت العمل اليومي (14 يوم)</h3>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={chartData}>
              <XAxis dataKey="day" tick={{ fill:'#475569', fontSize:10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background:'#1e2330', border:'1px solid #2a3040', borderRadius:8, fontSize:11 }}
                formatter={v=>[`${v} دقيقة`,'']} />
              <Bar dataKey="mins" fill="#f59e0b" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 style={{ fontSize:13, fontWeight:600, color:'#94a3b8', marginBottom:12, marginTop:0 }}>مهام منجزة يومياً (14 يوم)</h3>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={chartData}>
              <XAxis dataKey="day" tick={{ fill:'#475569', fontSize:10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background:'#1e2330', border:'1px solid #2a3040', borderRadius:8, fontSize:11 }}
                formatter={v=>[`${v} مهام`,'']} />
              <Bar dataKey="done" fill="#22c55e" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {!hasData && (
        <div className="card" style={{ textAlign:'center', padding:40, marginBottom:20 }}>
          <p style={{ fontSize:36, marginBottom:8 }}>📊</p>
          <p style={{ color:'#475569', fontSize:13 }}>سجّل وقتك لمدة 5 أيام على الأقل لتفعيل كاشف الإرهاق</p>
        </div>
      )}

      {loading && (
        <div className="card" style={{ textAlign:'center', padding:40 }}>
          <p style={{ fontSize:32, marginBottom:8, animation:'pulse 1s infinite' }}>🔮</p>
          <p style={{ color:'#94a3b8', fontSize:13 }}>Claude يحلل أنماطك...</p>
        </div>
      )}

      {result && levelConf && (
        <div className="fade-in">
          {/* Main result */}
          <div className="card" style={{ marginBottom:20, textAlign:'center', background:levelConf.bg, borderColor:levelConf.color+'44' }}>
            <p style={{ fontSize:52, margin:'0 0 8px' }}>{levelConf.icon}</p>
            <h2 style={{ fontSize:20, fontWeight:700, color:levelConf.color, margin:'0 0 6px' }}>{levelConf.label}</h2>
            <p style={{ fontSize:13, color:'#94a3b8', margin:'0 0 16px' }}>{levelConf.desc}</p>

            {/* Score gauge */}
            <div style={{ maxWidth:240, margin:'0 auto' }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#475569', marginBottom:6 }}>
                <span>مرتاح</span><span>مرهق جداً</span>
              </div>
              <div style={{ height:10, background:'#1e2330', borderRadius:5, position:'relative' }}>
                <div style={{ height:'100%', width:`${result.score}%`, background:`linear-gradient(90deg,#22c55e,${levelConf.color})`, borderRadius:5, transition:'width 1s ease' }} />
              </div>
              <p style={{ fontSize:13, color:levelConf.color, fontWeight:700, marginTop:6 }}>مستوى الضغط: {result.score}%</p>
            </div>
          </div>

          {/* Warning & Positive signs */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
            {result.warning_signs?.length > 0 && (
              <div className="card" style={{ borderColor:'#ef444433' }}>
                <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:12 }}>
                  <AlertTriangle size={13} color="#ef4444" />
                  <span style={{ fontSize:13, fontWeight:600, color:'#ef4444' }}>علامات تحذيرية</span>
                </div>
                {result.warning_signs.map((w,i) => (
                  <div key={i} style={{ display:'flex', gap:7, marginBottom:7, fontSize:12, color:'#94a3b8' }}>
                    <span style={{ color:'#ef4444', flexShrink:0 }}>⚠</span>{w}
                  </div>
                ))}
              </div>
            )}
            {result.positive_signs?.length > 0 && (
              <div className="card" style={{ borderColor:'#22c55e33' }}>
                <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:12 }}>
                  <CheckCircle size={13} color="#22c55e" />
                  <span style={{ fontSize:13, fontWeight:600, color:'#22c55e' }}>نقاط إيجابية</span>
                </div>
                {result.positive_signs.map((p,i) => (
                  <div key={i} style={{ display:'flex', gap:7, marginBottom:7, fontSize:12, color:'#94a3b8' }}>
                    <span style={{ color:'#22c55e', flexShrink:0 }}>✓</span>{p}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recommendation */}
          <div className="card" style={{ marginBottom:16, borderColor:levelConf.color+'33', background:levelConf.bg }}>
            <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:10 }}>
              <Zap size={13} color={levelConf.color} />
              <span style={{ fontSize:13, fontWeight:600, color:levelConf.color }}>التوصية</span>
            </div>
            <p style={{ fontSize:13, color:'#cbd5e1', margin:'0 0 12px', lineHeight:1.7 }}>{result.recommendation}</p>
            <div style={{ background:'rgba(0,0,0,0.2)', borderRadius:8, padding:'10px 14px' }}>
              <p style={{ fontSize:12, color:'#94a3b8', margin:'0 0 4px' }}>خطوة الآن 👇</p>
              <p style={{ fontSize:13, color:levelConf.color, fontWeight:600, margin:0 }}>{result.action}</p>
            </div>
          </div>

          <button onClick={runDetection} className="btn-ghost" style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontSize:12 }}>
            <RefreshCw size={12} /> فحص مجدداً
          </button>
        </div>
      )}
    </div>
  )
}
