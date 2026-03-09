import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { Plus, Trash2, Clock } from 'lucide-react'

const DAYS = [
  { value: 'saturday',  label: 'السبت' },
  { value: 'sunday',    label: 'الأحد' },
  { value: 'monday',    label: 'الاثنين' },
  { value: 'tuesday',   label: 'الثلاثاء' },
  { value: 'wednesday', label: 'الأربعاء' },
  { value: 'thursday',  label: 'الخميس' },
  { value: 'friday',    label: 'الجمعة' },
]

export default function Availability() {
  const { user } = useAuthStore()
  const [slots, setSlots]   = useState([])
  const [loading, setLoading] = useState(true)
  const [activeDay, setActiveDay] = useState('saturday')
  const [newSlot, setNewSlot] = useState({ from_time: '08:00', to_time: '12:00' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchSlots() }, [])

  async function fetchSlots() {
    setLoading(true)
    const { data } = await supabase.from('availability_slots')
      .select('*').eq('user_id', user.id).order('day').order('from_time')
    setSlots(data || [])
    setLoading(false)
  }

  async function addSlot() {
    if (newSlot.from_time >= newSlot.to_time) {
      alert('وقت البداية يجب أن يكون قبل وقت النهاية')
      return
    }
    setSaving(true)
    await supabase.from('availability_slots').insert({
      user_id: user.id,
      day: activeDay,
      from_time: newSlot.from_time,
      to_time: newSlot.to_time,
    })
    setNewSlot({ from_time: '08:00', to_time: '12:00' })
    setSaving(false)
    fetchSlots()
  }

  async function deleteSlot(id) {
    await supabase.from('availability_slots').delete().eq('id', id)
    setSlots(prev => prev.filter(s => s.id !== id))
  }

  function daySlots(day) { return slots.filter(s => s.day === day) }

  function calcHours(slots) {
    return slots.reduce((acc, s) => {
      const [fh, fm] = s.from_time.split(':').map(Number)
      const [th, tm] = s.to_time.split(':').map(Number)
      return acc + (th * 60 + tm - fh * 60 - fm) / 60
    }, 0)
  }

  const totalHours = calcHours(slots)

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>أوقات الفراغ 📅</h1>
        <p style={{ fontSize: 13, color: '#475569', margin: '4px 0 0' }}>
          حدد متى تكون متاحاً كل أسبوع — المجموع: {totalHours.toFixed(1)} ساعة/أسبوع
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20 }}>
        {/* Day selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {DAYS.map(d => {
            const count = daySlots(d.value).length
            const hrs   = calcHours(daySlots(d.value))
            return (
              <button
                key={d.value}
                onClick={() => setActiveDay(d.value)}
                style={{
                  padding: '12px 14px', borderRadius: 10, textAlign: 'right',
                  border: `1px solid ${activeDay === d.value ? '#f59e0b' : '#2a3040'}`,
                  background: activeDay === d.value ? 'rgba(245,158,11,0.08)' : '#13161d',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 500, color: activeDay === d.value ? '#f59e0b' : '#e2e8f0', marginBottom: 2 }}>
                  {d.label}
                </div>
                <div style={{ fontSize: 11, color: '#475569' }}>
                  {count > 0 ? `${hrs.toFixed(1)} ساعة` : 'لا يوجد'}
                </div>
              </button>
            )
          })}
        </div>

        {/* Day detail */}
        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 14, marginTop: 0 }}>
              {DAYS.find(d => d.value === activeDay)?.label}
              {' '}— أضف وقت فراغ
            </h3>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 5 }}>من</label>
                <input className="input" type="time" value={newSlot.from_time}
                  onChange={e => setNewSlot(p => ({ ...p, from_time: e.target.value }))}
                  style={{ width: 120 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 5 }}>إلى</label>
                <input className="input" type="time" value={newSlot.to_time}
                  onChange={e => setNewSlot(p => ({ ...p, to_time: e.target.value }))}
                  style={{ width: 120 }} />
              </div>
              <button className="btn-primary" onClick={addSlot} disabled={saving}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={13} /> إضافة
              </button>
            </div>
          </div>

          {/* Slots list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loading ? (
              <p style={{ color: '#475569', fontSize: 13 }}>جاري التحميل...</p>
            ) : daySlots(activeDay).length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 32, color: '#475569', fontSize: 13 }}>
                <Clock size={28} color="#2a3040" style={{ marginBottom: 10, display: 'block', margin: '0 auto 10px' }} />
                لا توجد أوقات فراغ ليوم {DAYS.find(d => d.value === activeDay)?.label}
              </div>
            ) : (
              daySlots(activeDay).map(slot => {
                const [fh, fm] = slot.from_time.split(':').map(Number)
                const [th, tm] = slot.to_time.split(':').map(Number)
                const hrs = ((th * 60 + tm) - (fh * 60 + fm)) / 60
                return (
                  <div key={slot.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: 'rgba(245,158,11,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Clock size={14} color="#f59e0b" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, color: '#e2e8f0', margin: 0, fontWeight: 500 }}>
                        {slot.from_time} — {slot.to_time}
                      </p>
                      <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>{hrs.toFixed(1)} ساعة</p>
                    </div>
                    <button
                      onClick={() => deleteSlot(slot.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2a3040', padding: 4 }}
                      onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={e => e.currentTarget.style.color = '#2a3040'}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
