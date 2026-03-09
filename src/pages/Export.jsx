import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { Download, FileText, Table, Calendar, CheckSquare, Clock } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { ar } from 'date-fns/locale'

function toCSV(headers, rows) {
  const escape = v => `"${String(v||'').replace(/"/g,'""')}"`
  return [headers.join(','), ...rows.map(r => r.map(escape).join(','))].join('\n')
}

function downloadFile(content, filename, type) {
  const blob = new Blob(['\uFEFF' + content], { type })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function generatePDFHTML({ tasks, timeLogs, goals, habits, range }) {
  const doneTasks  = tasks.filter(t=>t.status==='done').length
  const totalMins  = timeLogs.filter(l=>l.ended_at).reduce((a,l)=>a+Math.round((new Date(l.ended_at)-new Date(l.started_at))/60000),0)
  const catMap = {}
  timeLogs.filter(l=>l.ended_at).forEach(l=>{
    const m=Math.round((new Date(l.ended_at)-new Date(l.started_at))/60000)
    catMap[l.category]=(catMap[l.category]||0)+m
  })
  const catLabels={study:'مذاكرة',work:'عمل',entertainment:'ترفيه',exercise:'رياضة',other:'أخرى'}

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;color:#1a1a1a;margin:40px;direction:rtl}
  h1{color:#f59e0b;border-bottom:3px solid #f59e0b;padding-bottom:10px}
  h2{color:#374151;margin-top:30px}
  .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin:20px 0}
  .stat{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;text-align:center}
  .stat-val{font-size:28px;font-weight:700;color:#f59e0b}
  .stat-lbl{font-size:13px;color:#6b7280;margin-top:4px}
  table{width:100%;border-collapse:collapse;margin:10px 0}
  th{background:#f3f4f6;padding:10px;text-align:right;font-size:13px;border:1px solid #e5e7eb}
  td{padding:9px 10px;border:1px solid #e5e7eb;font-size:12px}
  tr:nth-child(even){background:#f9fafb}
  .done{color:#22c55e;font-weight:600}
  .pending{color:#f59e0b}
  footer{margin-top:40px;text-align:center;color:#9ca3af;font-size:12px;border-top:1px solid #e5e7eb;padding-top:16px}
</style></head>
<body>
<h1>تقرير ساديم 📊</h1>
<p style="color:#6b7280">الفترة: ${range} — تاريخ التصدير: ${format(new Date(),'d MMMM yyyy',{locale:ar})}</p>

<div class="stats">
  <div class="stat"><div class="stat-val">${doneTasks}/${tasks.length}</div><div class="stat-lbl">مهام منجزة</div></div>
  <div class="stat"><div class="stat-val">${Math.floor(totalMins/60)}س ${totalMins%60}د</div><div class="stat-lbl">إجمالي وقت العمل</div></div>
  <div class="stat"><div class="stat-val">${goals.filter(g=>g.status==='active').length}</div><div class="stat-lbl">أهداف نشطة</div></div>
</div>

<h2>توزيع الوقت بالفئات</h2>
<table><tr><th>الفئة</th><th>الوقت</th><th>النسبة</th></tr>
${Object.entries(catMap).sort((a,b)=>b[1]-a[1]).map(([cat,mins])=>`<tr><td>${catLabels[cat]||cat}</td><td>${Math.floor(mins/60)}س ${mins%60}د</td><td>${Math.round((mins/totalMins)*100)}%</td></tr>`).join('')}
</table>

<h2>الأهداف</h2>
<table><tr><th>الهدف</th><th>التقدم</th><th>الحالة</th><th>الموعد</th></tr>
${goals.map(g=>`<tr><td>${g.title}</td><td>${g.progress}%</td><td>${g.status==='active'?'نشط':'منتهي'}</td><td>${g.deadline||'—'}</td></tr>`).join('')}
</table>

<h2>المهام</h2>
<table><tr><th>المهمة</th><th>التاريخ</th><th>الأولوية</th><th>الحالة</th></tr>
${tasks.slice(0,50).map(t=>`<tr><td>${t.title}</td><td>${t.due_date||'—'}</td><td>${t.priority==='high'?'عالية':t.priority==='medium'?'متوسطة':'منخفضة'}</td><td class="${t.status==='done'?'done':'pending'}">${t.status==='done'?'✓ منجز':'قيد التنفيذ'}</td></tr>`).join('')}
</table>

<footer>صدّر من تطبيق ساديم • ${new Date().toLocaleDateString('ar')}</footer>
</body></html>`
}

export default function Export() {
  const { user }          = useAuthStore()
  const [range, setRange] = useState(7)
  const [loading, setLoading] = useState({})
  const [exported, setExported] = useState({})

  async function fetchData() {
    const from = subDays(new Date(), range).toISOString()
    const fromDate = subDays(new Date(), range).toISOString().split('T')[0]
    const [t, l, g, h] = await Promise.all([
      supabase.from('tasks').select('*').eq('user_id',user.id).gte('due_date',fromDate),
      supabase.from('time_logs').select('*').eq('user_id',user.id).gte('started_at',from),
      supabase.from('goals').select('*').eq('user_id',user.id),
      supabase.from('habits').select('*').eq('user_id',user.id),
    ])
    return { tasks:t.data||[], timeLogs:l.data||[], goals:g.data||[], habits:h.data||[] }
  }

  async function exportPDF() {
    setLoading(p=>({...p,pdf:true}))
    const data = await fetchData()
    const rangeLabel = `آخر ${range} يوم`
    const html = generatePDFHTML({ ...data, range:rangeLabel })
    const win = window.open('','_blank')
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(()=>win.print(),500)
    setLoading(p=>({...p,pdf:false}))
    setExported(p=>({...p,pdf:true}))
    setTimeout(()=>setExported(p=>({...p,pdf:false})),3000)
  }

  async function exportTasksCSV() {
    setLoading(p=>({...p,tasks:true}))
    const { tasks } = await fetchData()
    const csv = toCSV(
      ['العنوان','التاريخ','الأولوية','الحالة','الهدف المرتبط'],
      tasks.map(t=>[t.title,t.due_date,t.priority,t.status,t.goal_id||''])
    )
    downloadFile(csv, `مهام-ساديم-${format(new Date(),'yyyy-MM-dd')}.csv`, 'text/csv;charset=utf-8')
    setLoading(p=>({...p,tasks:false}))
    setExported(p=>({...p,tasks:true}))
    setTimeout(()=>setExported(p=>({...p,tasks:false})),3000)
  }

  async function exportTimeCSV() {
    setLoading(p=>({...p,time:true}))
    const { timeLogs } = await fetchData()
    const catLabels={study:'مذاكرة',work:'عمل',entertainment:'ترفيه',exercise:'رياضة',other:'أخرى'}
    const csv = toCSV(
      ['التاريخ','الفئة','المدة (دقيقة)','الموقع/الملاحظة','المصدر'],
      timeLogs.filter(l=>l.ended_at).map(l=>[
        l.started_at?.split('T')[0],
        catLabels[l.category]||l.category,
        Math.round((new Date(l.ended_at)-new Date(l.started_at))/60000),
        l.note||'',
        l.source||'يدوي'
      ])
    )
    downloadFile(csv, `سجل-الوقت-ساديم-${format(new Date(),'yyyy-MM-dd')}.csv`, 'text/csv;charset=utf-8')
    setLoading(p=>({...p,time:false}))
    setExported(p=>({...p,time:true}))
    setTimeout(()=>setExported(p=>({...p,time:false})),3000)
  }

  async function exportGoalsCSV() {
    setLoading(p=>({...p,goals:true}))
    const { goals } = await fetchData()
    const csv = toCSV(
      ['الهدف','الفئة','الأولوية','التقدم%','الحالة','الموعد'],
      goals.map(g=>[g.title,g.category,g.priority,g.progress,g.status,g.deadline||''])
    )
    downloadFile(csv, `أهداف-ساديم-${format(new Date(),'yyyy-MM-dd')}.csv`, 'text/csv;charset=utf-8')
    setLoading(p=>({...p,goals:false}))
    setExported(p=>({...p,goals:true}))
    setTimeout(()=>setExported(p=>({...p,goals:false})),3000)
  }

  const EXPORTS = [
    { key:'pdf',   icon:FileText,    label:'تقرير PDF كامل',     sub:'ملف PDF جاهز للطباعة مع كل الإحصائيات',  fn:exportPDF,      color:'#ef4444' },
    { key:'tasks', icon:CheckSquare, label:'المهام CSV',          sub:'كل مهامك في ملف Excel',                   fn:exportTasksCSV, color:'#f59e0b' },
    { key:'time',  icon:Clock,       label:'سجل الوقت CSV',       sub:'كل جلسات العمل مع الفئات والمدة',         fn:exportTimeCSV,  color:'#3b82f6' },
    { key:'goals', icon:Calendar,    label:'الأهداف CSV',          sub:'كل أهدافك مع نسبة التقدم',                fn:exportGoalsCSV, color:'#22c55e' },
  ]

  return (
    <div className="fade-in">
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontSize:22, fontWeight:700, color:'#e2e8f0', margin:0 }}>تصدير البيانات 📤</h1>
        <p style={{ fontSize:13, color:'#475569', margin:'4px 0 0' }}>صدّر بياناتك بأي صيغة تحبها</p>
      </div>

      {/* Range selector */}
      <div className="card" style={{ marginBottom:24 }}>
        <p style={{ fontSize:13, color:'#94a3b8', marginBottom:12 }}>الفترة الزمنية</p>
        <div style={{ display:'flex', gap:8 }}>
          {[7,14,30,90].map(d=>(
            <button key={d} onClick={()=>setRange(d)} style={{
              padding:'8px 18px', borderRadius:8, fontSize:13, cursor:'pointer',
              border:`1px solid ${range===d?'#f59e0b':'#2a3040'}`,
              background:range===d?'rgba(245,158,11,0.1)':'transparent',
              color:range===d?'#f59e0b':'#475569', transition:'all 0.15s',
            }}>آخر {d} يوم</button>
          ))}
        </div>
      </div>

      {/* Export options */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        {EXPORTS.map(({ key, icon:Icon, label, sub, fn, color }) => (
          <div key={key} className="card" style={{ borderColor:`${color}22`, transition:'border-color 0.2s' }}
            onMouseEnter={e=>e.currentTarget.style.borderColor=color+'66'}
            onMouseLeave={e=>e.currentTarget.style.borderColor=color+'22'}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
              <div style={{ width:42, height:42, borderRadius:10, background:`${color}15`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Icon size={18} color={color} />
              </div>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:14, fontWeight:600, color:'#e2e8f0', margin:'0 0 4px' }}>{label}</p>
                <p style={{ fontSize:12, color:'#475569', margin:'0 0 14px', lineHeight:1.5 }}>{sub}</p>
                <button onClick={fn} disabled={loading[key]} style={{
                  display:'flex', alignItems:'center', gap:6, padding:'8px 16px',
                  borderRadius:8, border:`1px solid ${color}44`,
                  background:exported[key]?`${color}20`:loading[key]?'#13161d':`${color}10`,
                  color:exported[key]?color:loading[key]?'#475569':color,
                  cursor:loading[key]?'wait':'pointer', fontSize:12, fontWeight:500,
                  transition:'all 0.2s',
                }}>
                  <Download size={12} />
                  {exported[key]?'✅ تم التصدير!':loading[key]?'جاري...':'تصدير'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop:20, padding:14, background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.15)', borderRadius:10, fontSize:12, color:'#64748b' }}>
        💡 الـ PDF بيفتح في نافذة جديدة — اضغط Ctrl+P أو Cmd+P للطباعة أو الحفظ كـ PDF
      </div>
    </div>
  )
}
