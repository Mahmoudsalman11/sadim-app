import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { Plus, Trash2, Bell, BellOff, Calendar, Clock } from 'lucide-react'
import { format, isPast, isToday, isTomorrow, differenceInMinutes } from 'date-fns'
import { ar } from 'date-fns/locale'

export default function Events() {
  const { user } = useAuthStore()
  const [events, setEvents]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [notifPerm, setNotifPerm] = useState(Notification?.permission || 'default')
  const [form, setForm]         = useState({ title: '', description: '', scheduled_at: '', reminder_minutes: 15 })
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    fetchEvents()
    checkReminders()
    const interval = setInterval(checkReminders, 60000)
    return () => clearInterval(interval)
  }, [])

  async function fetchEvents() {
    setLoading(true)
    const { data } = await supabase.from('events').select('*')
      .eq('user_id', user.id).order('scheduled_at')
    setEvents(data || [])
    setLoading(false)
  }

  async function checkReminders() {
    if (Notification?.permission !== 'granted') return
    const now = new Date()
    const { data } = await supabase.from('events').select('*')
      .eq('user_id', user.id).gte('scheduled_at', now.toISOString())
    ;(data || []).forEach(event => {
      const diff = differenceInMinutes(new Date(event.scheduled_at), now)
      if (diff > 0 && diff <= event.reminder_minutes) {
        new Notification(`⏰ تذكير: ${event.title}`, {
          body: `بعد ${diff} دقيقة — ${event.description || ''}`,
          icon: '/favicon.ico',
        })
      }
    })
  }

  async function requestNotifications() {
    const perm = await Notification.requestPermission()
    setNotifPerm(perm)
  }

  async function saveEvent() {
    if (!form.title.trim() || !form.scheduled_at) return
    setSaving(true)
    await supabase.from('events').insert({
      user_id: user.id,
      title: form.title.trim(),
      description: form.description.trim(),
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      reminder_minutes: Number(form.reminder_minutes),
    })
    setForm({ title: '', description: '', scheduled_at: '', reminder_minutes: 15 })
    setShowForm(false); setSaving(false); fetchEvents()
  }

  async function deleteEvent(id) {
    await supabase.from('events').delete().eq('id', id)
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  function getEventLabel(event) {
    const d = new Date(event.scheduled_at)
    if (isPast(d)) return { label: 'انتهى', color: '#475569' }
    if (isToday(d)) return { label: 'اليوم', color: '#22c55e' }
    if (isTomorrow(d)) return { label: 'غداً', color: '#f59e0b' }
    return { label: format(d, 'EEE d MMM', { locale: ar }), color: '#3b82f6' }
  }

  const upcoming = events.filter(e => !isPast(new Date(e.scheduled_at)))
  const past     = events.filter(e => isPast(new Date(e.scheduled_at)))

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>المواعيد والتذكيرات 🔔</h1>
          <p style={{ fontSize: 13, color: '#475569', margin: '4px 0 0' }}>{upcoming.length} موعد قادم</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {notifPerm !== 'granted' && (
            <button onClick={requestNotifications} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
              borderRadius: 8, fontSize: 13, cursor: 'pointer',
              background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#3b82f6',
            }}>
              <Bell size={13} /> تفعيل التنبيهات
            </button>
          )}
          {notifPerm === 'granted' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, fontSize: 12, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e' }}>
              <Bell size={12} /> التنبيهات مفعّلة
            </div>
          )}
          <button className="btn-primary" onClick={() => setShowForm(!showForm)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> موعد جديد
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="card fade-in" style={{ marginBottom: 20, borderColor: '#f59e0b44' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 14, marginTop: 0 }}>موعد جديد</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>عنوان الموعد *</label>
              <input className="input" placeholder="مثال: امتحان رياضيات" value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>التاريخ والوقت *</label>
              <input className="input" type="datetime-local" value={form.scheduled_at}
                onChange={e => setForm(p => ({ ...p, scheduled_at: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>تذكير قبل (دقائق)</label>
              <select className="input" value={form.reminder_minutes} onChange={e => setForm(p => ({ ...p, reminder_minutes: e.target.value }))}>
                {[5,10,15,30,60,120].map(m => <option key={m} value={m}>{m} دقيقة</option>)}
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>ملاحظات</label>
              <input className="input" placeholder="تفاصيل إضافية..." value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-primary" onClick={saveEvent} disabled={saving}>
              {saving ? 'جاري الحفظ...' : 'حفظ الموعد'}
            </button>
            <button className="btn-ghost" onClick={() => setShowForm(false)}>إلغاء</button>
          </div>
        </div>
      )}

      {/* Upcoming */}
      <h2 style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', marginBottom: 12 }}>المواعيد القادمة</h2>
      {loading ? <p style={{ color: '#475569', fontSize: 13 }}>جاري التحميل...</p>
        : upcoming.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 32, marginBottom: 20 }}>
            <Calendar size={32} color="#2a3040" style={{ marginBottom: 10, display: 'block', margin: '0 auto 10px' }} />
            <p style={{ color: '#475569', fontSize: 13 }}>لا توجد مواعيد قادمة</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {upcoming.map(event => {
              const { label, color } = getEventLabel(event)
              const d = new Date(event.scheduled_at)
              return (
                <div key={event.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: `${color}18`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color, lineHeight: 1 }}>{format(d, 'd')}</span>
                    <span style={{ fontSize: 9, color, textTransform: 'uppercase' }}>{format(d, 'MMM', { locale: ar })}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 500 }}>{event.title}</span>
                      <span className="badge" style={{ background: `${color}18`, color, fontSize: 10 }}>{label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: '#475569' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Clock size={10} /> {format(d, 'h:mm a')}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Bell size={10} /> قبل {event.reminder_minutes} دقيقة
                      </span>
                      {event.description && <span>{event.description}</span>}
                    </div>
                  </div>
                  <button onClick={() => deleteEvent(event.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2a3040', padding: 4 }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={e => e.currentTarget.style.color = '#2a3040'}>
                    <Trash2 size={13} />
                  </button>
                </div>
              )
            })}
          </div>
        )}

      {/* Past */}
      {past.length > 0 && (
        <>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 12 }}>مواعيد سابقة</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {past.slice(-5).reverse().map(event => (
              <div key={event.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#13161d', borderRadius: 8, opacity: 0.6 }}>
                <BellOff size={13} color="#475569" />
                <span style={{ fontSize: 13, color: '#475569', flex: 1, textDecoration: 'line-through' }}>{event.title}</span>
                <span style={{ fontSize: 11, color: '#2a3040' }}>{format(new Date(event.scheduled_at), 'd MMM', { locale: ar })}</span>
                <button onClick={() => deleteEvent(event.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2a3040', padding: 2 }}>
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
