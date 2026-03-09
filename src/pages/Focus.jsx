import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { Play, Pause, RotateCcw, Coffee, Brain, Zap, CheckSquare } from 'lucide-react'

const MODES = [
  { key: 'focus',  label: 'تركيز',    minutes: 25, color: '#f59e0b', icon: Brain,  desc: '25 دقيقة عمل مركّز' },
  { key: 'short',  label: 'استراحة',  minutes: 5,  color: '#22c55e', icon: Coffee, desc: '5 دقائق راحة قصيرة' },
  { key: 'long',   label: 'استراحة طويلة', minutes: 15, color: '#3b82f6', icon: Coffee, desc: '15 دقيقة راحة طويلة' },
]

export default function Focus() {
  const { user } = useAuthStore()
  const [mode, setMode]           = useState('focus')
  const [timeLeft, setTimeLeft]   = useState(25 * 60)
  const [running, setRunning]     = useState(false)
  const [sessions, setSessions]   = useState(0)
  const [tasks, setTasks]         = useState([])
  const [selectedTask, setSelectedTask] = useState('')
  const [logs, setLogs]           = useState([])
  const timerRef                  = useRef(null) // لحفظ الـ Interval
  
  // نستخدم localStorage لاسترجاع الـ ID عشان نكمل عليه لو عملنا ريفرش
  const [activeLogId, setActiveLogId] = useState(localStorage.getItem('sadim_focus_log_id') || null)

  const currentMode = MODES.find(m => m.key === mode)

  // 1. عند فتح الصفحة: استعادة الحالة (Persistence Check)
  useEffect(() => {
    // جلب البيانات الأساسية
    supabase.from('tasks').select('id,title').eq('user_id', user.id).neq('status','done').then(({ data }) => setTasks(data || []))
    fetchTodayLogs()

    // استعادة العداد لو كان شغال
    const savedEndTime = localStorage.getItem('sadim_focus_end_time')
    const savedMode    = localStorage.getItem('sadim_focus_mode')
    const savedTask    = localStorage.getItem('sadim_focus_task')

    if (savedEndTime && savedMode) {
      const remaining = Math.round((parseInt(savedEndTime) - Date.now()) / 1000)
      
      if (remaining > 0) {
        // لسه في وقت: كمل العد
        setMode(savedMode)
        setTimeLeft(remaining)
        setRunning(true)
        if (savedTask) setSelectedTask(savedTask)
      } else {
        // الوقت خلص وانت مش فاتح الصفحة: نظف واعتبره خلص
        clearPersistence()
        setMode(savedMode) // عشان يرجع للوضع الصح
        setTimeLeft(0)     // يظهر أصفار
        // (يمكنك هنا استدعاء handleComplete تلقائياً لو أردت)
      }
    }
  }, [])

  // 2. إدارة العداد (Timer Logic)
  useEffect(() => {
    if (running && timeLeft > 0) {
      // نستخدم Date.now لحساب الفرق بدقة (عشان لو المتصفح هنج أو النت فصل)
      const endTime = parseInt(localStorage.getItem('sadim_focus_end_time') || (Date.now() + timeLeft * 1000))
      
      // تأكد إننا حافظين وقت النهاية صح لو دي أول مرة
      if (!localStorage.getItem('sadim_focus_end_time')) {
        localStorage.setItem('sadim_focus_end_time', endTime)
        localStorage.setItem('sadim_focus_mode', mode)
        if (selectedTask) localStorage.setItem('sadim_focus_task', selectedTask)
      }

      timerRef.current = setInterval(() => {
        const secondsLeft = Math.round((endTime - Date.now()) / 1000)
        if (secondsLeft <= 0) {
          setTimeLeft(0)
          clearInterval(timerRef.current)
          handleComplete()
        } else {
          setTimeLeft(secondsLeft)
        }
      }, 1000)
    } else if (!running) {
      clearInterval(timerRef.current)
    }

    return () => clearInterval(timerRef.current)
  }, [running, mode]) // أضفنا mode للمراقبة

  async function fetchTodayLogs() {
    const todayStr = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('time_logs').select('*, tasks(title)').eq('user_id', user.id)
      .gte('started_at', todayStr).order('started_at', { ascending: false })
    setLogs(data || [])
  }

  // تنظيف الذاكرة
  function clearPersistence() {
    localStorage.removeItem('sadim_focus_end_time')
    localStorage.removeItem('sadim_focus_mode')
    localStorage.removeItem('sadim_focus_task')
    localStorage.removeItem('sadim_focus_log_id')
    setActiveLogId(null)
  }

  async function handleStart() {
    // تحديد وقت النهاية
    const durationSec = timeLeft > 0 && timeLeft < currentMode.minutes*60 ? timeLeft : currentMode.minutes * 60
    const endTime = Date.now() + (durationSec * 1000)
    
    // حفظ في LocalStorage فوراً
    localStorage.setItem('sadim_focus_end_time', endTime)
    localStorage.setItem('sadim_focus_mode', mode)
    if (selectedTask) localStorage.setItem('sadim_focus_task', selectedTask)

    if (mode === 'focus' && !activeLogId) {
      let category = 'study'
      if (selectedTask) {
        const task = tasks.find(t => t.id === selectedTask)
        if (task?.goal_id) {
          const { data: goal } = await supabase.from('goals').select('category').eq('id', task.goal_id).single()
          if (goal?.category) category = goal.category
        }
      }
      // إنشاء سجل في Supabase
      const { data } = await supabase.from('time_logs').insert({
        user_id: user.id,
        task_id: selectedTask || null,
        goal_id: tasks.find(t => t.id === selectedTask)?.goal_id || null,
        category,
        note: 'Pomodoro 🍅',
        started_at: new Date().toISOString(),
      }).select().single()
      
      if (data) {
        setActiveLogId(data.id)
        localStorage.setItem('sadim_focus_log_id', data.id)
      }
    }

    setRunning(true)
    
    // إرسال للإكستنشن (تفعيل الحجب)
    try {
      // إرسال المدة بالدقائق المتبقية
      const minsRemaining = Math.ceil(durationSec / 60)
      window.postMessage({ type:'START_FOCUS_MODE', minutes: minsRemaining }, '*')
    } catch {}
  }

  async function handlePause() {
    setRunning(false)
    // عند الإيقاف المؤقت، نمسح وقت النهاية عشان ميكملش عد في الخلفية، بس نحتفظ بالوقت المتبقي في الستيت
    localStorage.removeItem('sadim_focus_end_time') 
    
    try { window.postMessage({ type:'STOP_FOCUS_MODE' }, '*') } catch {}
    
    if (mode === 'focus' && activeLogId) {
      await supabase.from('time_logs').update({ ended_at: new Date().toISOString() }).eq('id', activeLogId)
      // لا نمسح الـ ID هنا عشان لو كملنا، نعمل سجل جديد أو نعدل (التبسيط: سجل جديد عند الاستئناف)
      clearPersistence() // نعتبر الجلسة انتهت كسجل، بس العداد واقف
      fetchTodayLogs()
    }
  }

  async function handleComplete() {
    setRunning(false)
    clearPersistence()
    
    if (mode === 'focus') {
      setSessions(s => s + 1)
      if (activeLogId) {
        await supabase.from('time_logs').update({ ended_at: new Date().toISOString() }).eq('id', activeLogId)
        fetchTodayLogs()
      }
      if (Notification?.permission === 'granted') new Notification('🍅 جلسة تركيز انتهت!', { body: 'أحسنت! خذ استراحة قصيرة.' })
      
      // التبديل التلقائي
      const nextMode = (sessions > 0 && (sessions + 1) % 4 === 0) ? 'long' : 'short'
      setMode(nextMode)
      setTimeLeft(MODES.find(m => m.key === nextMode).minutes * 60)
    } else {
      if (Notification?.permission === 'granted') new Notification('☕ انتهت الاستراحة!', { body: 'حان وقت التركيز مجدداً.' })
      setMode('focus')
      setTimeLeft(25 * 60)
    }
    
    try { window.postMessage({ type:'STOP_FOCUS_MODE' }, '*') } catch {}
  }

  async function handleReset() {
    setRunning(false)
    clearPersistence()
    
    if (activeLogId) {
      // اختياري: حذف السجل لو لغيته في نصه
      await supabase.from('time_logs').delete().eq('id', activeLogId)
    }
    setTimeLeft(currentMode.minutes * 60)
    try { window.postMessage({ type:'STOP_FOCUS_MODE' }, '*') } catch {}
  }

  const totalSecs = currentMode.minutes * 60
  const progress  = ((totalSecs - timeLeft) / totalSecs) * 100
  const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0')
  const ss = String(timeLeft % 60).padStart(2, '0')
  const circumference = 2 * Math.PI * 90

  const todayMins = logs.filter(l => l.ended_at).reduce((acc, l) => acc + Math.round((new Date(l.ended_at) - new Date(l.started_at)) / 60000), 0)
  const pomodoroLogs = logs.filter(l => l.note === 'Pomodoro 🍅')

  return (
    <div className="fade-in" style={{ maxWidth: 700, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>وضع التركيز 🍅</h1>
        <p style={{ fontSize: 13, color: '#475569', margin: '4px 0 0' }}>تقنية Pomodoro — اعمل بتركيز وخذ استراحات منتظمة</p>
      </div>

      {/* Mode selector */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 32, justifyContent: 'center' }}>
        {MODES.map(m => (
          <button key={m.key} onClick={() => { if(!running) { setMode(m.key); setTimeLeft(m.minutes*60); } }} style={{
            padding: '10px 20px', borderRadius: 10, fontSize: 13, cursor: 'pointer',
            border: `1px solid ${mode === m.key ? m.color : '#2a3040'}`,
            background: mode === m.key ? `${m.color}18` : '#13161d',
            color: mode === m.key ? m.color : '#475569',
            transition: 'all 0.2s',
            opacity: running && mode !== m.key ? 0.5 : 1 // تعطيل الأزرار أثناء العد
          }} disabled={running && mode !== m.key}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Timer circle */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
        <div style={{ position: 'relative', width: 220, height: 220 }}>
          <svg width="220" height="220" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="110" cy="110" r="90" fill="none" stroke="#1e2330" strokeWidth="8" />
            <circle cx="110" cy="110" r="90" fill="none" stroke={currentMode.color}
              strokeWidth="8" strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - (progress / 100) * circumference}
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 44, fontFamily: 'JetBrains Mono', fontWeight: 700, color: '#e2e8f0', letterSpacing: 2 }}>
              {mm}:{ss}
            </span>
            <span style={{ fontSize: 12, color: currentMode.color, marginTop: 4 }}>{currentMode.desc}</span>
          </div>
        </div>

        {/* Session dots */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} style={{
              width: 10, height: 10, borderRadius: '50%',
              background: i < (sessions % 4) ? currentMode.color : '#2a3040',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>
        <p style={{ fontSize: 12, color: '#475569', marginTop: 8 }}>{sessions} جلسة مكتملة اليوم</p>
      </div>

      {/* Task selector */}
      {mode === 'focus' && !running && (
        <div style={{ marginBottom: 20, maxWidth: 400, margin: '0 auto 20px' }}>
          <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6, textAlign: 'center' }}>تعمل على إيه؟ (اختياري)</label>
          <select className="input" value={selectedTask} onChange={e => setSelectedTask(e.target.value)}>
            <option value="">بدون مهمة محددة</option>
            {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 40 }}>
        {!running ? (
          <button onClick={handleStart} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 32px', borderRadius: 12, fontSize: 15, fontWeight: 600,
            background: currentMode.color, color: '#0d0f14', border: 'none', cursor: 'pointer',
            transition: 'opacity 0.2s',
          }}>
            <Play size={16} fill="#0d0f14" /> {timeLeft < currentMode.minutes*60 ? 'استكمال' : 'ابدأ'}
          </button>
        ) : (
          <button onClick={handlePause} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 32px', borderRadius: 12, fontSize: 15, fontWeight: 600,
            background: 'rgba(239,68,68,0.15)', color: '#ef4444',
            border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer',
          }}>
            <Pause size={16} /> إيقاف مؤقت
          </button>
        )}
        <button onClick={handleReset} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '12px 20px',
          borderRadius: 12, fontSize: 14, background: 'transparent',
          border: '1px solid #2a3040', color: '#475569', cursor: 'pointer',
        }}>
          <RotateCcw size={14} /> إعادة
        </button>
      </div>

      {/* Today stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'وقت اليوم', value: `${Math.floor(todayMins/60)}س ${todayMins%60}د`, icon: Zap, color: '#f59e0b' },
          { label: 'جلسات Pomodoro', value: pomodoroLogs.length, icon: Brain, color: '#a855f7' },
          { label: 'مهام منجزة', value: logs.filter(l => l.task_id).length, icon: CheckSquare, color: '#22c55e' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card" style={{ textAlign: 'center', padding: 16 }}>
            <Icon size={18} color={color} style={{ marginBottom: 8 }} />
            <p style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>{value}</p>
            <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Today's sessions log */}
      {pomodoroLogs.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 12, marginTop: 0 }}>جلسات اليوم</h3>
          {pomodoroLogs.slice(0, 5).map((log, i) => {
            const mins = log.ended_at ? Math.round((new Date(log.ended_at) - new Date(log.started_at)) / 60000) : null
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #1e2330' }}>
                <span style={{ fontSize: 12, color: '#f59e0b' }}>🍅</span>
                <span style={{ fontSize: 12, color: '#e2e8f0', flex: 1 }}>
                  {log.tasks?.title || 'تركيز عام'}
                </span>
                <span style={{ fontSize: 11, color: '#475569', fontFamily: 'JetBrains Mono' }}>
                  {mins ? `${mins}د` : 'جارية...'}
                </span>
                <span style={{ fontSize: 11, color: '#2a3040' }}>
                  {new Date(log.started_at).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}