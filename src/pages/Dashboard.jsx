import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { getSmartAdvice } from '../lib/ai'
import { Target, CheckSquare, Clock, TrendingUp, Sparkles, ArrowLeft, Zap, Brain } from 'lucide-react'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const CAT = {
  study:         { color:'#4f9cf9', label:'مذاكرة' },
  work:          { color:'#f0a500', label:'عمل' },
  entertainment: { color:'#9b72f5', label:'ترفيه' },
  exercise:      { color:'#2dd4aa', label:'رياضة' },
  other:         { color:'#4a5270', label:'أخرى' },
  ai:            { color:'#2dd4aa', label:'AI' },
}

function StatCard({ icon:Icon, label, value, color, sub }) {
  return (
    <div className="stat-card fade-in" style={{ position:'relative', overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:14 }}>
        <div style={{ width:38, height:38, borderRadius:10, background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon size={17} color={color} />
        </div>
        {sub && <span style={{ fontSize:10, color:'var(--text-muted)', background:'var(--bg-overlay)', padding:'2px 8px', borderRadius:20 }}>{sub}</span>}
      </div>
      <p style={{ fontSize:26, fontWeight:700, color:'var(--text-primary)', margin:'0 0 4px', fontFamily:'var(--font-mono)' }}>{value}</p>
      <p style={{ fontSize:11, color:'var(--text-muted)', margin:0 }}>{label}</p>
      {/* Color accent line */}
      <div style={{ position:'absolute', bottom:0, right:0, left:0, height:2, background:`linear-gradient(90deg, ${color}00, ${color}88)` }} />
    </div>
  )
}

export default function Dashboard() {
  const { user }        = useAuthStore()
  const [data, setData] = useState({ goals:[], tasks:[], logs:[] })
  const [pie, setPie]   = useState([])
  const [advice, setAdvice] = useState('')
  const [loading, setLoading] = useState(true)
  const today = format(new Date(), 'EEEE، d MMMM', { locale:ar })

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const todayStr = new Date().toISOString().split('T')[0]
    const [gR, tR, lR, alR] = await Promise.all([
      supabase.from('goals').select('*').eq('user_id',user.id).eq('status','active').order('progress'),
      supabase.from('tasks').select('*').eq('user_id',user.id).eq('due_date',todayStr),
      supabase.from('time_logs').select('*').eq('user_id',user.id).gte('started_at',todayStr),
      supabase.from('time_logs').select('*').eq('user_id',user.id).gte('started_at', new Date(Date.now()-7*86400000).toISOString()),
    ])
    const logs=lR.data||[], allLogs=alR.data||[], goals=gR.data||[], tasks=tR.data||[]
    const catMap={}
    logs.filter(l=>l.ended_at).forEach(l=>{
      const m=Math.round((new Date(l.ended_at)-new Date(l.started_at))/60000)
      catMap[l.category]=(catMap[l.category]||0)+m
    })
    setPie(Object.entries(catMap).map(([cat,mins])=>({ name:CAT[cat]?.label||cat, value:mins, color:CAT[cat]?.color||'#4a5270' })))
    setData({ goals, tasks, logs:allLogs })
    setLoading(false)
    getSmartAdvice({ goals, tasks, timeLogs:allLogs }).then(setAdvice).catch(()=>{})
  }

  const todayMins   = (data.logs||[]).filter(l=>l.ended_at&&l.started_at?.startsWith(new Date().toISOString().split('T')[0])).reduce((a,l)=>a+Math.round((new Date(l.ended_at)-new Date(l.started_at))/60000),0)
  const doneTasks   = data.tasks.filter(t=>t.status==='done').length
  const completion  = data.tasks.length ? Math.round((doneTasks/data.tasks.length)*100) : 0
  const pendingTasks= data.tasks.filter(t=>t.status!=='done').slice(0,4)

  if (loading) return (
    <div className="loading-screen">
      <div style={{ textAlign:'center' }}>
        <div style={{ width:44, height:44, background:'linear-gradient(135deg,var(--gold),var(--gold-2))', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px', boxShadow:'var(--shadow-gold)' }}>
          <Sparkles size={20} color="#07091a" />
        </div>
        <div className="spinner" style={{ margin:'0 auto' }} />
      </div>
    </div>
  )

  return (
    <div className="fade-in">

      {/* Header */}
      <div style={{ marginBottom:32 }}>
        <p style={{ fontSize:12, color:'var(--text-muted)', margin:'0 0 6px', textTransform:'uppercase', letterSpacing:'0.08em' }}>{today}</p>
        <h1 style={{ fontSize:26, fontWeight:700, color:'var(--text-primary)', margin:0 }}>
          مرحباً 👋 — <span style={{ color:'var(--gold)' }}>ماذا ستنجز اليوم؟</span>
        </h1>
      </div>

      {/* Stats */}
      <div className="stagger" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:28 }}>
        <StatCard icon={Target}      label="أهداف نشطة"  value={data.goals.length}               color="var(--gold)"   />
        <StatCard icon={CheckSquare} label="مهام اليوم"  value={`${doneTasks}/${data.tasks.length}`} color="var(--blue)"  sub={`${completion}%`} />
        <StatCard icon={Clock}       label="دقائق اليوم" value={todayMins}                         color="var(--green)"  />
        <StatCard icon={TrendingUp}  label="إنجاز اليوم" value={`${completion}%`}                  color="var(--purple)" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>

        {/* AI Advice */}
        <div className="card card-gold">
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <div style={{ width:28, height:28, borderRadius:8, background:'rgba(240,165,0,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Sparkles size={13} color="var(--gold)" />
            </div>
            <span style={{ fontSize:12, fontWeight:600, color:'var(--gold)' }}>نصيحة سديم</span>
          </div>
          {advice
            ? <p style={{ fontSize:13, color:'var(--text-secondary)', margin:0, lineHeight:1.75 }}>{advice}</p>
            : <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                <div className="spinner" style={{ width:14, height:14, borderWidth:2 }} />
                <span style={{ fontSize:12, color:'var(--text-muted)' }}>جاري التحليل...</span>
              </div>
          }
        </div>

        {/* Today's pie chart */}
        <div className="card">
          <p style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)', margin:'0 0 10px' }}>توزيع وقت اليوم</p>
          {pie.length > 0 ? (
            <div style={{ display:'flex', alignItems:'center', gap:16 }}>
              <ResponsiveContainer width={90} height={90}>
                <PieChart>
                  <Pie data={pie} cx="50%" cy="50%" innerRadius={26} outerRadius={42} dataKey="value" strokeWidth={0}>
                    {pie.map((e,i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:5 }}>
                {pie.slice(0,4).map(p => (
                  <div key={p.name} style={{ display:'flex', alignItems:'center', gap:7 }}>
                    <div style={{ width:8, height:8, borderRadius:2, background:p.color, flexShrink:0 }} />
                    <span style={{ fontSize:11, color:'var(--text-secondary)', flex:1 }}>{p.name}</span>
                    <span style={{ fontSize:11, color:'var(--text-primary)', fontFamily:'var(--font-mono)', fontWeight:600 }}>{p.value}د</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state" style={{ padding:'20px 0' }}>
              <span style={{ fontSize:28, marginBottom:6 }}>📊</span>
              <p>لم تسجّل وقتاً بعد</p>
            </div>
          )}
        </div>
      </div>

      {/* Goals + Tasks */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>

        {/* Goals */}
        <div className="card">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:7 }}>
              <Target size={14} color="var(--gold)" />
              <span style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>أهدافي</span>
            </div>
            <Link to="/goals" style={{ fontSize:11, color:'var(--text-muted)', textDecoration:'none', display:'flex', alignItems:'center', gap:4, transition:'color 0.15s' }}
              onMouseEnter={e=>e.currentTarget.style.color='var(--gold)'}
              onMouseLeave={e=>e.currentTarget.style.color='var(--text-muted)'}>
              الكل <ArrowLeft size={10} />
            </Link>
          </div>
          {data.goals.length === 0 ? (
            <div className="empty-state" style={{ padding:'20px 0' }}>
              <span style={{ fontSize:28, marginBottom:6 }}>🎯</span>
              <p>لا توجد أهداف نشطة</p>
              <Link to="/goals" className="btn-ghost" style={{ fontSize:11, padding:'6px 14px', textDecoration:'none' }}>+ أضف هدفاً</Link>
            </div>
          ) : data.goals.slice(0,3).map(goal => (
            <div key={goal.id} style={{ marginBottom:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <span style={{ fontSize:12, color:'var(--text-secondary)' }}>{goal.title}</span>
                <span style={{ fontSize:11, color:'var(--gold)', fontFamily:'var(--font-mono)', fontWeight:600 }}>{goal.progress}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width:`${goal.progress}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* Pending tasks */}
        <div className="card">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:7 }}>
              <CheckSquare size={14} color="var(--blue)" />
              <span style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>مهام اليوم</span>
            </div>
            <Link to="/tasks" style={{ fontSize:11, color:'var(--text-muted)', textDecoration:'none', display:'flex', alignItems:'center', gap:4 }}
              onMouseEnter={e=>e.currentTarget.style.color='var(--gold)'}
              onMouseLeave={e=>e.currentTarget.style.color='var(--text-muted)'}>
              الكل <ArrowLeft size={10} />
            </Link>
          </div>
          {pendingTasks.length === 0 ? (
            <div className="empty-state" style={{ padding:'20px 0' }}>
              <span style={{ fontSize:28, marginBottom:6 }}>✅</span>
              <p>{doneTasks > 0 ? 'أنجزت كل مهام اليوم!' : 'لا توجد مهام اليوم'}</p>
            </div>
          ) : pendingTasks.map((task,i) => (
            <div key={task.id} style={{
              display:'flex', alignItems:'center', gap:10, padding:'10px 0',
              borderBottom: i<pendingTasks.length-1 ? '1px solid var(--border-subtle)' : 'none',
            }}>
              <div style={{ width:6, height:6, borderRadius:'50%', flexShrink:0,
                background: task.priority==='high'?'var(--red)':task.priority==='medium'?'var(--gold)':'var(--text-muted)' }} />
              <span style={{ fontSize:12, color:'var(--text-secondary)', flex:1 }}>{task.title}</span>
              <span className={`badge ${task.priority==='high'?'badge-red':task.priority==='medium'?'badge-amber':'badge-green'}`} style={{ fontSize:9 }}>
                {task.priority==='high'?'عالية':task.priority==='medium'?'متوسطة':'منخفضة'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick nav cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginTop:20 }}>
        {[
          { to:'/focus',        icon:Zap,     label:'وضع التركيز',   color:'var(--gold)',   sub:'ابدأ بومودورو' },
          { to:'/smart-planner',icon:Brain,   label:'المخطط الذكي', color:'var(--purple)', sub:'AI يخطط ليومك' },
          { to:'/chat',         icon:Sparkles,label:'سديم AI',       color:'var(--green)',  sub:'اسأل مساعدك' },
        ].map(({ to, icon:Icon, label, color, sub }) => (
          <Link key={to} to={to} style={{ textDecoration:'none' }}>
            <div style={{
              background:'var(--bg-surface)', border:`1px solid var(--border-subtle)`,
              borderRadius:14, padding:'14px 16px', cursor:'pointer',
              transition:'all 0.2s', display:'flex', alignItems:'center', gap:12,
            }}
              onMouseEnter={e=>{ e.currentTarget.style.borderColor=color; e.currentTarget.style.background='var(--bg-elevated)' }}
              onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--border-subtle)'; e.currentTarget.style.background='var(--bg-surface)' }}>
              <div style={{ width:36, height:36, borderRadius:10, background:`${color}15`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Icon size={16} color={color} />
              </div>
              <div>
                <p style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', margin:0 }}>{label}</p>
                <p style={{ fontSize:11, color:'var(--text-muted)', margin:0 }}>{sub}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

    </div>
  )
}
