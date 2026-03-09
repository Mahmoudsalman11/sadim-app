import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { Shield, Target, Bell, Flame, Mail, Plus, Trash2, Save, Check, AlertTriangle, Clock } from 'lucide-react'

const TABS = [
  { key:'blocker',  icon:Shield,  label:'حاجب المواقع' },
  { key:'goals',    icon:Target,  label:'ربط الأهداف' },
  { key:'alerts',   icon:Bell,    label:'تنبيهات الوقت' },
  { key:'streak',   icon:Flame,   label:'الـ Streak' },
  { key:'email',    icon:Mail,    label:'تقرير الإيميل' },
]

export default function ExtensionHub() {
  const { user }        = useAuthStore()
  const [tab, setTab]   = useState('blocker')
  const [goals, setGoals] = useState([])
  const [settings, setSettings] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const [gR, sR] = await Promise.all([
      supabase.from('goals').select('id,title').eq('user_id',user.id).eq('status','active'),
      supabase.from('extension_settings').select('*').eq('user_id',user.id).single(),
    ])
    setGoals(gR.data||[])
    setSettings(sR.data || {
      user_id: user.id,
      blocked_sites: [],
      site_goal_map:  {},
      time_alerts:    {},
      daily_streak_target: 120,
      email_report: false,
      email_day: 'friday',
    })
  }

  async function saveSettings(patch) {
    const updated = { ...settings, ...patch }
    setSettings(updated)
    if (settings?.id) {
      await supabase.from('extension_settings').update(updated).eq('id', settings.id)
    } else {
      const { data } = await supabase.from('extension_settings').insert(updated).select().single()
      if (data) setSettings(data)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!settings) return (
    <div style={{ padding:40, color:'var(--text-muted)', textAlign:'center' }}>
      <div className="spinner" style={{ margin:'0 auto 12px' }} />
    </div>
  )

  return (
    <div className="fade-in">
      <div style={{ marginBottom:28 }}>
        <h1 className="page-title">التحكم بالمتصفح 🛡️</h1>
        <p className="page-subtitle">تحكم في عادات التصفح مباشرة من التطبيق</p>
      </div>

      <div style={{ display:'flex', gap:20 }}>

        {/* Sidebar tabs */}
        <div style={{ width:200, flexShrink:0, display:'flex', flexDirection:'column', gap:4 }}>
          {TABS.map(({ key, icon:Icon, label }) => (
            <button key={key} onClick={()=>setTab(key)} style={{
              display:'flex', alignItems:'center', gap:10, padding:'11px 14px',
              borderRadius:10, border:`1px solid ${tab===key?'rgba(240,165,0,0.3)':'var(--border-subtle)'}`,
              background: tab===key ? 'rgba(240,165,0,0.08)' : 'var(--bg-surface)',
              color: tab===key ? 'var(--gold)' : 'var(--text-muted)',
              cursor:'pointer', fontSize:13, fontFamily:'var(--font-ar)',
              fontWeight: tab===key ? 600 : 400, transition:'all 0.15s',
              textAlign:'right',
            }}>
              <Icon size={14} /> {label}
            </button>
          ))}

          {saved && (
            <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', background:'rgba(45,212,170,0.1)', border:'1px solid rgba(45,212,170,0.2)', borderRadius:10, marginTop:4 }}>
              <Check size={13} color="var(--green)" />
              <span style={{ fontSize:12, color:'var(--green)' }}>تم الحفظ</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ flex:1 }}>

          {/* ── SITE BLOCKER ── */}
          {tab==='blocker' && (
            <BlockerTab settings={settings} onSave={saveSettings} />
          )}

          {/* ── GOAL LINKING ── */}
          {tab==='goals' && (
            <GoalLinkTab settings={settings} goals={goals} onSave={saveSettings} />
          )}

          {/* ── TIME ALERTS ── */}
          {tab==='alerts' && (
            <AlertsTab settings={settings} onSave={saveSettings} />
          )}

          {/* ── STREAK ── */}
          {tab==='streak' && (
            <StreakTab settings={settings} userId={user.id} onSave={saveSettings} />
          )}

          {/* ── EMAIL REPORT ── */}
          {tab==='email' && (
            <EmailTab settings={settings} userId={user.id} userEmail={user.email} onSave={saveSettings} />
          )}

        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
// SITE BLOCKER
// ═══════════════════════════════════════
function BlockerTab({ settings, onSave }) {
  const [input, setInput] = useState('')
  const [schedule, setSchedule] = useState({ enabled: false, from:'09:00', to:'17:00' })

  const blocked = settings.blocked_sites || []

  function addSite() {
    const site = input.trim().replace(/^https?:\/\/(www\.)?/,'').split('/')[0]
    if (!site || blocked.includes(site)) return
    onSave({ blocked_sites: [...blocked, site] })
    setInput('')
  }

  return (
    <div className="card">
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20 }}>
        <Shield size={16} color="var(--red)" />
        <h2 style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)', margin:0 }}>حاجب المواقع المشتتة</h2>
      </div>
      <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:20, lineHeight:1.7 }}>
        أضف المواقع اللي تشتتك — الإكستنشن هيمنعها تلقائياً وهيديك رسالة تذكير بأهدافك
      </p>

      {/* Add */}
      <div style={{ display:'flex', gap:8, marginBottom:20 }}>
        <input className="input" value={input} onChange={e=>setInput(e.target.value)}
          placeholder="youtube.com أو twitter.com..."
          onKeyDown={e=>e.key==='Enter'&&addSite()} style={{ flex:1 }} />
        <button className="btn-primary" onClick={addSite}>
          <Plus size={13} /> إضافة
        </button>
      </div>

      {/* Schedule */}
      <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', borderRadius:12, padding:16, marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: schedule.enabled ? 14 : 0 }}>
          <div>
            <p style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', margin:'0 0 2px' }}>جدول الحجب التلقائي</p>
            <p style={{ fontSize:11, color:'var(--text-muted)', margin:0 }}>حجب المواقع في أوقات محددة بس</p>
          </div>
          <label className="toggle-wrap">
            <input type="checkbox" checked={schedule.enabled} onChange={e=>setSchedule({...schedule, enabled:e.target.checked})} />
            <span className="toggle-slider" />
          </label>
        </div>
        {schedule.enabled && (
          <div style={{ display:'flex', gap:12, alignItems:'center' }}>
            <div style={{ flex:1 }}>
              <label style={{ fontSize:10, color:'var(--text-muted)', display:'block', marginBottom:4 }}>من</label>
              <input type="time" value={schedule.from} onChange={e=>setSchedule({...schedule,from:e.target.value})}
                style={{ background:'var(--bg-overlay)', border:'1px solid var(--border-default)', borderRadius:7, padding:'6px 10px', color:'var(--text-primary)', width:'100%', fontFamily:'var(--font-mono)' }} />
            </div>
            <div style={{ flex:1 }}>
              <label style={{ fontSize:10, color:'var(--text-muted)', display:'block', marginBottom:4 }}>لـ</label>
              <input type="time" value={schedule.to} onChange={e=>setSchedule({...schedule,to:e.target.value})}
                style={{ background:'var(--bg-overlay)', border:'1px solid var(--border-default)', borderRadius:7, padding:'6px 10px', color:'var(--text-primary)', width:'100%', fontFamily:'var(--font-mono)' }} />
            </div>
            <button className="btn-primary" style={{ marginTop:18 }} onClick={()=>onSave({ block_schedule: schedule })}>
              <Save size={12} />
            </button>
          </div>
        )}
      </div>

      {/* List */}
      {blocked.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🛡️</span>
          <p>لم تضف أي مواقع بعد</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {blocked.map(site => (
            <div key={site} style={{ display:'flex', alignItems:'center', gap:10, background:'var(--bg-surface)', border:'1px solid rgba(240,99,74,0.15)', borderRadius:9, padding:'9px 12px' }}>
              <AlertTriangle size={12} color="var(--red)" />
              <span style={{ flex:1, fontSize:13, color:'var(--text-secondary)', fontFamily:'var(--font-mono)' }}>{site}</span>
              <button onClick={()=>onSave({ blocked_sites: blocked.filter(s=>s!==site) })}
                style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:2, transition:'color 0.15s' }}
                onMouseEnter={e=>e.currentTarget.style.color='var(--red)'}
                onMouseLeave={e=>e.currentTarget.style.color='var(--text-muted)'}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════
// GOAL LINKING
// ═══════════════════════════════════════
function GoalLinkTab({ settings, goals, onSave }) {
  const [site, setSite]     = useState('')
  const [goalId, setGoalId] = useState('')
  const map = settings.site_goal_map || {}

  function addLink() {
    const domain = site.trim().replace(/^https?:\/\/(www\.)?/,'').split('/')[0]
    if (!domain || !goalId) return
    onSave({ site_goal_map: { ...map, [domain]: goalId } })
    setSite(''); setGoalId('')
  }

  return (
    <div className="card">
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20 }}>
        <Target size={16} color="var(--gold)" />
        <h2 style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)', margin:0 }}>ربط المواقع بالأهداف</h2>
      </div>
      <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:20, lineHeight:1.7 }}>
        ربّط كل موقع بهدف معين — الوقت اللي بتقضيه في الموقع هيتحسب تلقائياً على الهدف ده
      </p>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:8, marginBottom:20 }}>
        <input className="input" value={site} onChange={e=>setSite(e.target.value)}
          placeholder="github.com" />
        <select className="input" value={goalId} onChange={e=>setGoalId(e.target.value)}>
          <option value="">اختر هدفاً...</option>
          {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
        </select>
        <button className="btn-primary" onClick={addLink} disabled={!site||!goalId}>
          <Plus size={13} /> ربط
        </button>
      </div>

      {Object.keys(map).length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🔗</span>
          <p>لم تربط أي موقع بهدف بعد</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {Object.entries(map).map(([domain, gid]) => {
            const goal = goals.find(g=>g.id===gid)
            return (
              <div key={domain} style={{ display:'flex', alignItems:'center', gap:10, background:'var(--bg-surface)', border:'1px solid rgba(240,165,0,0.12)', borderRadius:9, padding:'10px 14px' }}>
                <span style={{ fontSize:12, fontFamily:'var(--font-mono)', color:'var(--text-secondary)', flex:1 }}>{domain}</span>
                <span style={{ fontSize:10, color:'var(--text-muted)' }}>→</span>
                <span style={{ fontSize:12, color:'var(--gold)', fontWeight:600 }}>{goal?.title||'هدف محذوف'}</span>
                <button onClick={()=>{ const m={...map}; delete m[domain]; onSave({ site_goal_map:m }) }}
                  style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:2 }}
                  onMouseEnter={e=>e.currentTarget.style.color='var(--red)'}
                  onMouseLeave={e=>e.currentTarget.style.color='var(--text-muted)'}>
                  <Trash2 size={12} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════
// TIME ALERTS
// ═══════════════════════════════════════
function AlertsTab({ settings, onSave }) {
  const [site, setSite]   = useState('')
  const [mins, setMins]   = useState(30)
  const alerts = settings.time_alerts || {}

  function addAlert() {
    const domain = site.trim().replace(/^https?:\/\/(www\.)?/,'').split('/')[0]
    if (!domain) return
    onSave({ time_alerts: { ...alerts, [domain]: Number(mins) } })
    setSite('')
  }

  return (
    <div className="card">
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20 }}>
        <Bell size={16} color="var(--blue)" />
        <h2 style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)', margin:0 }}>تنبيهات الوقت</h2>
      </div>
      <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:20, lineHeight:1.7 }}>
        حدد حد أقصى لكل موقع — لما توصل للحد هياخد notification ويفرقعلك popup تذكير
      </p>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 120px auto', gap:8, marginBottom:20 }}>
        <input className="input" value={site} onChange={e=>setSite(e.target.value)}
          placeholder="instagram.com" onKeyDown={e=>e.key==='Enter'&&addAlert()} />
        <div style={{ position:'relative' }}>
          <input type="number" className="input" value={mins} onChange={e=>setMins(e.target.value)} min={5} max={480}
            style={{ paddingLeft:32 }} />
          <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontSize:10, color:'var(--text-muted)' }}>د</span>
        </div>
        <button className="btn-primary" onClick={addAlert} disabled={!site}>
          <Plus size={13} /> إضافة
        </button>
      </div>

      {Object.keys(alerts).length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🔔</span>
          <p>لا توجد تنبيهات محددة</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {Object.entries(alerts).map(([domain, limit]) => (
            <div key={domain} style={{ display:'flex', alignItems:'center', gap:10, background:'var(--bg-surface)', border:'1px solid rgba(79,156,249,0.15)', borderRadius:9, padding:'10px 14px' }}>
              <Clock size={12} color="var(--blue)" />
              <span style={{ flex:1, fontSize:12, fontFamily:'var(--font-mono)', color:'var(--text-secondary)' }}>{domain}</span>
              <span className="badge badge-blue" style={{ fontSize:11 }}>{limit} دقيقة</span>
              <button onClick={()=>{ const a={...alerts}; delete a[domain]; onSave({ time_alerts:a }) }}
                style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:2 }}
                onMouseEnter={e=>e.currentTarget.style.color='var(--red)'}
                onMouseLeave={e=>e.currentTarget.style.color='var(--text-muted)'}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════
// STREAK
// ═══════════════════════════════════════
function StreakTab({ settings, userId, onSave }) {
  const [streak, setStreak] = useState(null)
  const target = settings.daily_streak_target || 120

  useEffect(() => { calcStreak() }, [])

  async function calcStreak() {
    const { data: logs } = await supabase.from('time_logs').select('started_at,ended_at,category')
      .eq('user_id', userId).gte('started_at', new Date(Date.now()-30*86400000).toISOString())
    if (!logs) return

    let current=0, best=0, temp=0
    const productive = ['study','work','ai']
    for (let i=0; i<30; i++) {
      const d=new Date(Date.now()-i*86400000).toISOString().split('T')[0]
      const dayMins = logs.filter(l=>l.started_at?.startsWith(d)&&l.ended_at&&productive.includes(l.category))
        .reduce((a,l)=>a+Math.round((new Date(l.ended_at)-new Date(l.started_at))/60000),0)
      if (dayMins >= target) { temp++; if(i===0||current>0) current=temp }
      else { best=Math.max(best,temp); temp=0; if(i===0) current=0 }
    }
    best = Math.max(best, temp, current)
    setStreak({ current, best })
  }

  return (
    <div className="card">
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20 }}>
        <Flame size={16} color="var(--orange)" />
        <h2 style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)', margin:0 }}>نظام الـ Streak 🔥</h2>
      </div>

      {streak && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:24 }}>
          <div style={{ textAlign:'center', background:'var(--bg-surface)', border:'1px solid rgba(249,118,52,0.2)', borderRadius:14, padding:20 }}>
            <p style={{ fontSize:42, margin:'0 0 4px', filter:'drop-shadow(0 0 8px rgba(249,118,52,0.4))' }}>🔥</p>
            <p style={{ fontSize:32, fontWeight:800, color:'var(--orange)', margin:'0 0 4px', fontFamily:'var(--font-mono)' }}>{streak.current}</p>
            <p style={{ fontSize:12, color:'var(--text-muted)', margin:0 }}>Streak الحالي</p>
          </div>
          <div style={{ textAlign:'center', background:'var(--bg-surface)', border:'1px solid rgba(240,165,0,0.15)', borderRadius:14, padding:20 }}>
            <p style={{ fontSize:42, margin:'0 0 4px' }}>🏆</p>
            <p style={{ fontSize:32, fontWeight:800, color:'var(--gold)', margin:'0 0 4px', fontFamily:'var(--font-mono)' }}>{streak.best}</p>
            <p style={{ fontSize:12, color:'var(--text-muted)', margin:0 }}>أفضل Streak</p>
          </div>
        </div>
      )}

      <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border-default)', borderRadius:12, padding:16 }}>
        <label style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)', display:'block', marginBottom:10 }}>
          الهدف اليومي للـ Streak
        </label>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input type="range" min={30} max={480} step={30} value={target}
            onChange={e=>onSave({ daily_streak_target:Number(e.target.value) })}
            style={{ flex:1, accentColor:'var(--gold)' }} />
          <span style={{ fontSize:14, fontWeight:700, color:'var(--gold)', fontFamily:'var(--font-mono)', minWidth:50 }}>
            {target >= 60 ? `${Math.floor(target/60)}س ${target%60>0?target%60+'د':''}` : `${target}د`}
          </span>
        </div>
        <p style={{ fontSize:11, color:'var(--text-muted)', marginTop:8, margin:'8px 0 0' }}>
          لازم تحقق {target} دقيقة من العمل أو المذاكرة عشان تحافظ على الـ Streak
        </p>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
// EMAIL REPORT
// ═══════════════════════════════════════
function EmailTab({ settings, userId, userEmail, onSave }) {
  const [sending, setSending] = useState(false)
  const [sent, setSent]       = useState(false)

  const DAYS = [
    { val:'saturday', label:'السبت' }, { val:'sunday', label:'الأحد' },
    { val:'friday',   label:'الجمعة' }, { val:'monday', label:'الاثنين' },
  ]

  async function sendTestReport() {
    setSending(true)
    try {
      const { data: logs } = await supabase.from('time_logs').select('*')
        .eq('user_id', userId).gte('started_at', new Date(Date.now()-7*86400000).toISOString())
      const { data: goals } = await supabase.from('goals').select('*').eq('user_id',userId).eq('status','active')
      const { data: tasks } = await supabase.from('tasks').select('*').eq('user_id',userId)

      const totalMins = (logs||[]).filter(l=>l.ended_at).reduce((a,l)=>a+Math.round((new Date(l.ended_at)-new Date(l.started_at))/60000),0)
      const doneTasks = (tasks||[]).filter(t=>t.status==='done'&&t.due_date>=new Date(Date.now()-7*86400000).toISOString().split('T')[0]).length

      // Supabase Edge Function (لو موجودة) أو mailto fallback
      const subject = `📊 تقرير ساديم الأسبوعي`
      const body    = `تقرير الأسبوع الماضي:\n\n✅ مهام منجزة: ${doneTasks}\n⏱ وقت العمل: ${Math.floor(totalMins/60)}س ${totalMins%60}د\n🎯 أهداف نشطة: ${(goals||[]).length}\n\nأفتح تطبيق ساديم لتفاصيل أكثر.`
      window.location.href = `mailto:${userEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

      setSent(true)
      setTimeout(() => setSent(false), 3000)
    } catch {}
    setSending(false)
  }

  return (
    <div className="card">
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20 }}>
        <Mail size={16} color="var(--purple)" />
        <h2 style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)', margin:0 }}>التقرير الأسبوعي بالإيميل</h2>
      </div>

      {/* Enable toggle */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--bg-surface)', border:'1px solid var(--border-default)', borderRadius:12, padding:'14px 16px', marginBottom:16 }}>
        <div>
          <p style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', margin:'0 0 2px' }}>تفعيل التقرير الأسبوعي</p>
          <p style={{ fontSize:11, color:'var(--text-muted)', margin:0 }}>تقرير ملخص كل أسبوع على إيميلك</p>
        </div>
        <label className="toggle-wrap">
          <input type="checkbox" checked={settings.email_report} onChange={e=>onSave({ email_report:e.target.checked })} />
          <span className="toggle-slider" />
        </label>
      </div>

      {settings.email_report && (
        <div style={{ marginBottom:20 }}>
          <label style={{ fontSize:11, fontWeight:600, color:'var(--text-secondary)', display:'block', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.06em' }}>يوم الإرسال</label>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {DAYS.map(d => (
              <button key={d.val} onClick={()=>onSave({ email_day:d.val })} style={{
                padding:'7px 16px', borderRadius:8, border:`1px solid ${settings.email_day===d.val?'rgba(155,114,245,0.4)':'var(--border-default)'}`,
                background: settings.email_day===d.val ? 'rgba(155,114,245,0.1)' : 'transparent',
                color: settings.email_day===d.val ? 'var(--purple)' : 'var(--text-muted)',
                cursor:'pointer', fontSize:12, fontFamily:'var(--font-ar)', transition:'all 0.15s',
              }}>{d.label}</button>
            ))}
          </div>
        </div>
      )}

      <div style={{ background:'rgba(155,114,245,0.06)', border:'1px solid rgba(155,114,245,0.15)', borderRadius:12, padding:16, marginBottom:16 }}>
        <p style={{ fontSize:12, color:'var(--text-muted)', margin:'0 0 6px' }}>سيُرسل إلى:</p>
        <p style={{ fontSize:13, color:'var(--purple)', fontWeight:600, margin:0 }}>{userEmail}</p>
      </div>

      <button className="btn-primary" onClick={sendTestReport} disabled={sending} style={{ width:'100%', justifyContent:'center' }}>
        <Mail size={13} />
        {sent ? '✅ فُتح الإيميل!' : sending ? 'جاري...' : 'إرسال تقرير تجريبي الآن'}
      </button>
      <p style={{ fontSize:11, color:'var(--text-muted)', marginTop:8, textAlign:'center' }}>سيفتح تطبيق الإيميل جاهزاً للإرسال</p>
    </div>
  )
}
