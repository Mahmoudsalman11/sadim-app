import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { ShieldOff, TrendingDown, AlertTriangle, Clock } from 'lucide-react'
import { subDays, format } from 'date-fns'
import { ar } from 'date-fns/locale'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function DistractionLog() {
  const { user } = useAuthStore()
  const [logs, setLogs]     = useState([])
  const [loading, setLoading] = useState(true)
  const [range, setRange]   = useState(7)

  useEffect(() => { fetchLogs() }, [range])

  async function fetchLogs() {
    setLoading(true)
    const from = subDays(new Date(), range).toISOString().split('T')[0]
    const { data } = await supabase
      .from('distraction_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('attempted_at', from)
      .order('attempted_at', { ascending: false })
    setLogs(data || [])
    setLoading(false)
  }

  // Group by domain
  const byDomain = logs.reduce((acc, l) => {
    acc[l.domain] = (acc[l.domain] || 0) + 1
    return acc
  }, {})
  const domainArr = Object.entries(byDomain).sort((a,b) => b[1]-a[1])

  // Group by day for chart
  const byDay = {}
  logs.forEach(l => {
    const d = l.attempted_at?.split('T')[0]
    if (d) byDay[d] = (byDay[d] || 0) + 1
  })
  const chartData = Array.from({ length: range }, (_, i) => {
    const d = subDays(new Date(), range - 1 - i)
    const ds = format(d, 'yyyy-MM-dd')
    return { day: format(d, 'EEE', { locale: ar }), count: byDay[ds] || 0, date: ds }
  })

  const totalAttempts = logs.length
  const savedMins     = Math.round(totalAttempts * 8) // متوسط 8 دقائق لكل محاولة

  return (
    <div className="fade-in">
      <div style={{ marginBottom:28 }}>
        <h1 className="page-title">سجل المشتتات 🛡️</h1>
        <p className="page-subtitle">كم مرة حجبك ساديم عن مواقع مشتتة؟</p>
      </div>

      {/* Range selector */}
      <div style={{ display:'flex', gap:8, marginBottom:20 }}>
        {[7,14,30].map(d => (
          <button key={d} onClick={() => setRange(d)} style={{
            padding:'6px 16px', borderRadius:20, fontSize:12, cursor:'pointer',
            border:`1px solid ${range===d?'rgba(240,165,0,0.4)':'var(--border-subtle)'}`,
            background: range===d?'rgba(240,165,0,0.1)':'transparent',
            color: range===d?'var(--gold)':'var(--text-muted)',
          }}>{d} يوم</button>
        ))}
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:24 }}>
        {[
          { icon:ShieldOff, label:'محاولة حجب', value:totalAttempts, color:'var(--red)' },
          { icon:Clock,     label:'دقيقة وُفِّرت', value:savedMins,   color:'var(--green)' },
          { icon:AlertTriangle, label:'موقع مختلف', value:domainArr.length, color:'var(--gold)' },
        ].map(({ icon:Icon, label, value, color }) => (
          <div key={label} className="stat-card">
            <div style={{ width:32, height:32, borderRadius:9, background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:10 }}>
              <Icon size={15} color={color} />
            </div>
            <p style={{ fontSize:22, fontWeight:700, color:'var(--text-primary)', margin:'0 0 3px', fontFamily:'var(--font-mono)' }}>{value}</p>
            <p style={{ fontSize:10, color:'var(--text-muted)', margin:0 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      {chartData.some(d => d.count > 0) && (
        <div className="card" style={{ marginBottom:20 }}>
          <p style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)', margin:'0 0 14px' }}>محاولات الدخول يومياً</p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={chartData} barSize={14}>
              <XAxis dataKey="day" tick={{ fill:'var(--text-muted)', fontSize:10 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background:'var(--bg-elevated)', border:'1px solid var(--border-default)', borderRadius:8, fontSize:11 }}
                formatter={(v) => [`${v} محاولة`, '']}
              />
              <Bar dataKey="count" fill="var(--red)" radius={[3,3,0,0]} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top distracting sites */}
      <div className="card">
        <p style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)', margin:'0 0 14px' }}>🏆 أكثر المواقع التي حاولت دخولها</p>
        {loading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : domainArr.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🎉</span>
            <p>{totalAttempts === 0 ? 'لا يوجد سجل حجب بعد — أضف مواقع للحجب من صفحة التحكم بالمتصفح' : 'ممتاز! لا توجد محاولات في هذه الفترة'}</p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {domainArr.slice(0,10).map(([domain, count], i) => {
              const pct = Math.round((count / totalAttempts) * 100)
              return (
                <div key={domain} style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:11, color:'var(--text-muted)', width:16, fontFamily:'var(--font-mono)' }}>{i+1}</span>
                  <span style={{ flex:1, fontSize:12, color:'var(--text-secondary)', fontFamily:'var(--font-mono)' }}>{domain}</span>
                  <div style={{ width:80, height:4, background:'var(--bg-overlay)', borderRadius:2, overflow:'hidden' }}>
                    <div style={{ width:`${pct}%`, height:'100%', background:'var(--red)', borderRadius:2 }} />
                  </div>
                  <span style={{ fontSize:11, fontWeight:600, color:'var(--red)', fontFamily:'var(--font-mono)', width:28, textAlign:'left' }}>{count}x</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Recent attempts */}
      {logs.length > 0 && (
        <div className="card" style={{ marginTop:16 }}>
          <p style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)', margin:'0 0 12px' }}>آخر المحاولات</p>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {logs.slice(0,8).map(l => (
              <div key={l.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid var(--border-subtle)' }}>
                <ShieldOff size={12} color="var(--red)" />
                <span style={{ flex:1, fontSize:11, fontFamily:'var(--font-mono)', color:'var(--text-secondary)' }}>{l.domain}</span>
                <span style={{ fontSize:10, color:'var(--text-muted)' }}>
                  {l.attempted_at ? format(new Date(l.attempted_at), 'EEE d MMM، h:mm a', { locale: ar }) : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
