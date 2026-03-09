import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { getSmartAdvice } from '../lib/ai'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import { Target, CheckSquare, Clock, Flame, Bell, Sparkles, ArrowLeft } from 'lucide-react'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 5)  return { text:'ليلة طيبة 🌙',     sub:'وقت الراحة' }
  if (h < 12) return { text:'صباح الخير ☀️',    sub:'يوم جديد، فرصة جديدة' }
  if (h < 17) return { text:'مساء النشاط 💪',  sub:'الوقت لا يزال أمامك' }
  if (h < 21) return { text:'مساء الخير 🌅',    sub:'كيف كان يومك؟' }
  return             { text:'مساء النور 🌙',     sub:'راجع إنجازات يومك' }
}

export default function DailyBriefing() {
  const { user }            = useAuthStore()
  const [data, setData]     = useState({ tasks:[], goals:[], events:[], habits:[], habitLogs:[], logs:[] })
  const [advice, setAdvice] = useState('')
  const [loading, setLoading] = useState(true)

  const today = format(new Date(), 'yyyy-MM-dd')
  const greeting = getGreeting()

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [t, g, e, h, hl, l] = await Promise.all([
      supabase.from('tasks').select('*').eq('user_id',user.id).eq('due_date',today),
      supabase.from('goals').select('*').eq('user_id',user.id).eq('status','active').order('progress'),
      supabase.from('events').select('*').eq('user_id',user.id).gte('scheduled_at',new Date().toISOString()).order('scheduled_at').limit(3),
      supabase.from('habits').select('*').eq('user_id',user.id),
      supabase.from('habit_logs').select('*').eq('user_id',user.id).eq('log_date',today),
      supabase.from('time_logs').select('*').eq('user_id',user.id).gte('started_at',today),
    ])
    const d = { tasks:t.data||[], goals:g.data||[], events:e.data||[], habits:h.data||[], habitLogs:hl.data||[], logs:l.data||[] }
    setData(d)
    setLoading(false)

    // AI advice in background
    getSmartAdvice({ goals:d.goals, tasks:d.tasks, timeLogs:d.logs }).then(setAdvice).catch(()=>{})
  }

  const doneTasks = data.tasks.filter(t=>t.status==='done').length
  const todayMins = data.logs.filter(l=>l.ended_at).reduce((a,l)=>a+Math.round((new Date(l.ended_at)-new Date(l.started_at))/60000),0)
  const habitsDone = data.habitLogs.length
  const top3Tasks = data.tasks.filter(t=>t.status!=='done').sort((a,b)=>['high','medium','low'].indexOf(a.priority)-['high','medium','low'].indexOf(b.priority)).slice(0,3)

  // Streak
  const [streak, setStreak] = useState(0)
  useEffect(() => {
    if (!data.logs.length) return
    let s=0
    for(let i=0;i<30;i++){
      const d=new Date(Date.now()-i*86400000).toISOString().split('T')[0]
      if(data.logs.some(l=>l.started_at?.startsWith(d)&&l.ended_at)) s++
      else if(i>0) break
    }
    setStreak(s)
  }, [data.logs])

  if (loading) return <div style={{ color:'#475569', padding:40 }}>جاري التحميل...</div>

  return (
    <div className="fade-in" style={{ maxWidth:680, margin:'0 auto' }}>
      {/* Greeting */}
      <div style={{ textAlign:'center', marginBottom:32 }}>
        <p style={{ fontSize:13, color:'#475569', margin:'0 0 6px' }}>{format(new Date(),'EEEE، d MMMM yyyy',{locale:ar})}</p>
        <h1 style={{ fontSize:28, fontWeight:800, color:'#e2e8f0', margin:'0 0 4px' }}>{greeting.text}</h1>
        <p style={{ fontSize:14, color:'#64748b', margin:0 }}>{greeting.sub}</p>
      </div>

      {/* Stats strip */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        {[
          { icon:CheckSquare, label:'مهام اليوم', value:`${doneTasks}/${data.tasks.length}`, color:'#f59e0b' },
          { icon:Clock,       label:'وقت العمل',  value:`${Math.floor(todayMins/60)}:${String(todayMins%60).padStart(2,'0')}`, color:'#3b82f6' },
          { icon:Target,      label:'العادات',    value:`${habitsDone}/${data.habits.length}`, color:'#22c55e' },
          { icon:Flame,       label:'Streak 🔥',  value:`${streak} يوم`, color:'#ef4444' },
        ].map(({ icon:Icon, label, value, color }) => (
          <div key={label} className="card" style={{ textAlign:'center', padding:14 }}>
            <Icon size={16} color={color} style={{ marginBottom:6 }} />
            <p style={{ fontSize:18, fontWeight:700, color:'#e2e8f0', margin:0 }}>{value}</p>
            <p style={{ fontSize:11, color:'#475569', margin:'3px 0 0' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* AI Advice */}
      {advice && (
        <div className="card" style={{ marginBottom:20, borderColor:'#f59e0b33', background:'rgba(245,158,11,0.04)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:8 }}>
            <Sparkles size={13} color="#f59e0b" />
            <span style={{ fontSize:12, color:'#f59e0b', fontWeight:600 }}>نصيحة سديم لليوم</span>
          </div>
          <p style={{ fontSize:13, color:'#cbd5e1', margin:0, lineHeight:1.7 }}>{advice}</p>
        </div>
      )}

      {/* Top 3 Tasks */}
      <div className="card" style={{ marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <h3 style={{ fontSize:14, fontWeight:600, color:'#e2e8f0', margin:0 }}>🎯 أهم 3 مهام اليوم</h3>
          <Link to="/tasks" style={{ fontSize:12, color:'#f59e0b', textDecoration:'none', display:'flex', alignItems:'center', gap:4 }}>كل المهام <ArrowLeft size={11} /></Link>
        </div>
        {top3Tasks.length === 0 ? (
          <p style={{ color:'#475569', fontSize:13, textAlign:'center', padding:'12px 0' }}>
            {doneTasks > 0 ? `🎉 أنجزت كل مهام اليوم!` : 'لا توجد مهام — أضف مهمة من الزرار العائم ⚡'}
          </p>
        ) : (
          top3Tasks.map((task, i) => (
            <div key={task.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom: i<top3Tasks.length-1?'1px solid #1e2330':'none' }}>
              <div style={{ width:22, height:22, borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(245,158,11,0.12)', color:'#f59e0b', fontSize:11, fontWeight:700, flexShrink:0 }}>{i+1}</div>
              <span style={{ fontSize:13, color:'#e2e8f0', flex:1 }}>{task.title}</span>
              <span className={`badge ${task.priority==='high'?'badge-red':task.priority==='medium'?'badge-amber':'badge-green'}`} style={{ fontSize:10 }}>
                {task.priority==='high'?'عالية':task.priority==='medium'?'متوسطة':'منخفضة'}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Goals progress */}
      {data.goals.length > 0 && (
        <div className="card" style={{ marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <h3 style={{ fontSize:14, fontWeight:600, color:'#e2e8f0', margin:0 }}>📈 تقدم الأهداف</h3>
            <Link to="/goals" style={{ fontSize:12, color:'#f59e0b', textDecoration:'none', display:'flex', alignItems:'center', gap:4 }}>الكل <ArrowLeft size={11} /></Link>
          </div>
          {data.goals.slice(0,3).map(goal => (
            <div key={goal.id} style={{ marginBottom:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:5 }}>
                <span style={{ color:'#e2e8f0' }}>{goal.title}</span>
                <span style={{ color:'#f59e0b', fontFamily:'JetBrains Mono' }}>{goal.progress}%</span>
              </div>
              <div className="progress-bar"><div className="progress-fill" style={{ width:`${goal.progress}%` }} /></div>
            </div>
          ))}
        </div>
      )}

      {/* Upcoming events */}
      {data.events.length > 0 && (
        <div className="card" style={{ marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <h3 style={{ fontSize:14, fontWeight:600, color:'#e2e8f0', margin:0 }}>🔔 مواعيد قريبة</h3>
            <Link to="/events" style={{ fontSize:12, color:'#f59e0b', textDecoration:'none' }}>الكل</Link>
          </div>
          {data.events.map(event => (
            <div key={event.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 0', borderBottom:'1px solid #1e2330' }}>
              <Bell size={13} color="#3b82f6" />
              <span style={{ fontSize:13, color:'#e2e8f0', flex:1 }}>{event.title}</span>
              <span style={{ fontSize:11, color:'#475569' }}>{format(new Date(event.scheduled_at),'d MMM h:mm a')}</span>
            </div>
          ))}
        </div>
      )}

      {/* Habits today */}
      {data.habits.length > 0 && (
        <div className="card">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <h3 style={{ fontSize:14, fontWeight:600, color:'#e2e8f0', margin:0 }}>🔁 عادات اليوم</h3>
            <Link to="/habits" style={{ fontSize:12, color:'#f59e0b', textDecoration:'none' }}>تفاصيل</Link>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
            {data.habits.map(habit => {
              const done = data.habitLogs.some(l=>l.habit_id===habit.id)
              return (
                <div key={habit.id} style={{
                  display:'flex', alignItems:'center', gap:8, padding:'8px 12px',
                  borderRadius:10, border:`1px solid ${done?habit.color+'44':'#2a3040'}`,
                  background: done?`${habit.color}10`:'#13161d',
                }}>
                  <span style={{ fontSize:16 }}>{habit.icon}</span>
                  <span style={{ fontSize:12, color:done?habit.color:'#64748b' }}>{habit.name}</span>
                  {done && <span style={{ fontSize:11, color:habit.color }}>✓</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
