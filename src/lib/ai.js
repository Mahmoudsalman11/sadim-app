const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

async function callClaude(systemPrompt, userMessage) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1024,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage },
      ],
    }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error?.message || JSON.stringify(data))
  return data.choices[0].message.content
}

// نصايح ذكية
export async function getSmartAdvice({ goals, tasks, timeLogs }) {
  const system = `أنت مساعد ذكي متخصص في إدارة الوقت والإنتاجية.
تحلل بيانات المستخدم وتعطي نصائح عملية ومحددة باللغة العربية.
ردودك دايماً قصيرة (3-4 جمل)، عملية، مشجعة، ومبنية على البيانات الفعلية.`

  const doneTasks = tasks.filter(t => t.status === 'done').length
  const todayMins = timeLogs.reduce((acc, l) => {
    if (l.ended_at) return acc + Math.round((new Date(l.ended_at) - new Date(l.started_at)) / 60000)
    return acc
  }, 0)

  return callClaude(system, `بيانات اليوم:
- الأهداف النشطة: ${goals.length} هدف
- مهام اليوم: ${doneTasks} منجزة من ${tasks.length}
- وقت العمل: ${Math.floor(todayMins/60)}س ${todayMins%60}د
- أهم هدف: ${goals[0]?.title || 'لم يحدد'}
- المهام المتبقية: ${tasks.filter(t=>t.status!=='done').map(t=>t.title).join(', ')||'لا يوجد'}
أعطني نصيحة واحدة مخصصة ومحددة.`)
}

// إعادة جدولة المهام المتأخرة
export async function rescheduleOverdueTasks(overdueTasks, availability) {
  const system = `أنت مساعد متخصص في جدولة المهام. رد فقط بـ JSON صالح بدون أي نص إضافي.`
  const today = new Date().toISOString().split('T')[0]

  const text = await callClaude(system, `المهام المتأخرة:
${overdueTasks.map(t => `- "${t.title}" (أولوية: ${t.priority})`).join('\n')}
تاريخ اليوم: ${today}
أعد جدولتها على الأيام القادمة. رد بـ JSON فقط:
{"rescheduled":[{"title":"اسم المهمة","new_date":"YYYY-MM-DD","reason":"سبب الاختيار"}]}`)

  try { return JSON.parse(text.replace(/```json|```/g,'').trim()) }
  catch { return { rescheduled: [] } }
}

// تحليل أنماط النشاط
export async function analyzeProductivityPatterns(timeLogs) {
  const system = `أنت محلل إنتاجية. رد فقط بـ JSON صالح بدون أي نص إضافي.`
  const hourlyData = {}
  timeLogs.forEach(log => {
    if (!log.ended_at) return
    const hour = new Date(log.started_at).getHours()
    const mins = Math.round((new Date(log.ended_at) - new Date(log.started_at)) / 60000)
    hourlyData[hour] = (hourlyData[hour] || 0) + mins
  })

  const text = await callClaude(system, `بيانات الوقت حسب الساعة:
${Object.entries(hourlyData).map(([h,m])=>`${h}:00 — ${m} دقيقة`).join('\n')}
رد بـ JSON فقط:
{"peak_hours":"وصف أوقات الذروة","rest_hours":"وصف أوقات الراحة","recommendation":"توصية الجدول المثالي","best_hour":9}`)

  try { return JSON.parse(text.replace(/```json|```/g,'').trim()) }
  catch { return { peak_hours: 'بيانات غير كافية', rest_hours: '—', recommendation: 'سجّل وقتك أكثر للحصول على تحليل', best_hour: 9 } }
}

// خطة أسبوعية بالـ AI
export async function generateWeeklyPlan({ goals, tasks, availability }) {
  const system = `أنت مخطط إنتاجية محترف. رد فقط بـ JSON صالح بدون أي نص إضافي.`
  const today = new Date()
  const days = ['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة']

  const text = await callClaude(system, `أهداف المستخدم: ${goals.map(g=>g.title).join(', ')||'لا يوجد'}
مهام قيد التنفيذ: ${tasks.filter(t=>t.status!=='done').map(t=>`${t.title}(${t.priority})`).join(', ')||'لا يوجد'}
أيام الفراغ: ${[...new Set(availability.map(a=>a.day))].map(d=>days.find((_,i)=>['saturday','sunday','monday','tuesday','wednesday','thursday','friday'][i]===d)||d).join(', ')||'مش محدد'}
تاريخ اليوم: ${today.toISOString().split('T')[0]}

اصنع خطة أسبوعية عملية. رد بـ JSON فقط:
{"week_goal":"هدف الأسبوع","days":[{"day":"اسم اليوم","focus":"محور اليوم","tasks":["مهمة1","مهمة2"],"tip":"نصيحة اليوم"}],"motivation":"جملة تحفيزية"}`)

  try { return JSON.parse(text.replace(/```json|```/g,'').trim()) }
  catch { return null }
}

// توقع تحقيق الهدف
export async function predictGoalCompletion({ goal, timeLogs, weeklyHours }) {
  const system = `أنت محلل بيانات. رد فقط بـ JSON صالح بدون أي نص إضافي.`

  const text = await callClaude(system, `الهدف: ${goal.title}
التقدم الحالي: ${goal.progress}%
المتبقي: ${100 - goal.progress}%
ساعات الفراغ الأسبوعية: ${weeklyHours} ساعة
الموعد النهائي: ${goal.deadline || 'غير محدد'}

قدّر متى سيتحقق الهدف. رد بـ JSON فقط:
{"weeks_needed":4,"expected_date":"YYYY-MM-DD","daily_minutes":30,"advice":"نصيحة لتسريع الإنجاز","on_track":true}`)

  try { return JSON.parse(text.replace(/```json|```/g,'').trim()) }
  catch { return null }
}

// ==========================================
// تقسيم المهمة الكبيرة على وقت اليوم
// ==========================================
export async function smartTaskBreakdown({ taskTitle, availableSlots, existingTasks }) {
  const system = `أنت مساعد تخطيط محترف. رد فقط بـ JSON صالح بدون أي نص إضافي.`

  const totalMins = availableSlots.reduce((acc, s) => {
    const [fh, fm] = s.from_time.split(':').map(Number)
    const [th, tm] = s.to_time.split(':').map(Number)
    return acc + ((th * 60 + tm) - (fh * 60 + fm))
  }, 0)

  const text = await callClaude(system, `المهمة الكبيرة: "${taskTitle}"
الوقت المتاح اليوم: ${totalMins} دقيقة
أوقات الفراغ: ${availableSlots.map(s => `${s.day} ${s.from_time}-${s.to_time}`).join(', ')}
المهام الموجودة فعلاً: ${existingTasks.map(t => t.title).join(', ') || 'لا يوجد'}

قسّم المهمة لخطوات عملية صغيرة وزّعها على الوقت المتاح.
رد بـ JSON فقط:
{
  "subtasks": [
    {
      "title": "اسم الخطوة",
      "duration_minutes": 30,
      "order": 1,
      "tip": "نصيحة سريعة"
    }
  ],
  "total_minutes": 120,
  "feasible": true,
  "summary": "ملخص الخطة"
}`)

  try { return JSON.parse(text.replace(/\`\`\`json|\`\`\`/g, '').trim()) }
  catch { return null }
}

// ==========================================
// هل وقتك المخصص للهدف كافي؟
// ==========================================
export async function checkGoalTimeSufficiency({ goal, timeLogs, availableSlots }) {
  const system = `أنت محلل بيانات إنتاجية. رد فقط بـ JSON صالح بدون أي نص إضافي.`

  // حساب متوسط الوقت اليومي على الهدف
  const goalLogs = timeLogs.filter(l => l.goal_id === goal.id || l.note?.includes(goal.title))
  const totalMinsLogged = goalLogs.filter(l => l.ended_at).reduce((acc, l) =>
    acc + Math.round((new Date(l.ended_at) - new Date(l.started_at)) / 60000), 0)
  const daysActive = new Set(goalLogs.map(l => l.started_at?.split('T')[0])).size || 1
  const avgDailyMins = Math.round(totalMinsLogged / daysActive)

  // وقت الفراغ الأسبوعي
  const weeklyFreeMins = availableSlots.reduce((acc, s) => {
    const [fh, fm] = s.from_time.split(':').map(Number)
    const [th, tm] = s.to_time.split(':').map(Number)
    return acc + ((th * 60 + tm) - (fh * 60 + fm))
  }, 0)

  // أيام متبقية للـ deadline
  const daysLeft = goal.deadline
    ? Math.max(0, Math.round((new Date(goal.deadline) - new Date()) / 86400000))
    : 90

  const text = await callClaude(system, `الهدف: "${goal.title}"
التقدم الحالي: ${goal.progress}% (متبقي ${100 - goal.progress}%)
متوسط الوقت اليومي الفعلي: ${avgDailyMins} دقيقة
وقت الفراغ الأسبوعي المتاح: ${weeklyFreeMins} دقيقة
الأيام المتبقية للـ deadline: ${daysLeft} يوم
إجمالي الوقت المسجل على الهدف: ${totalMinsLogged} دقيقة

هل الوقت المخصص كافي لتحقيق الهدف؟
رد بـ JSON فقط:
{
  "sufficient": true,
  "risk_level": "low",
  "avg_daily_needed": 45,
  "avg_daily_actual": 30,
  "gap_minutes": 15,
  "weeks_to_complete": 8,
  "verdict": "جملة حكم واضحة",
  "recommendation": "توصية عملية محددة",
  "adjusted_deadline": "YYYY-MM-DD"
}`)

  try { return JSON.parse(text.replace(/\`\`\`json|\`\`\`/g, '').trim()) }
  catch { return null }
}

// ==========================================
// جدول ساعة بساعة لليوم
// ==========================================
export async function buildDailySchedule({ tasks, availableSlots, timeLogs, preferences }) {
  const system = `أنت مخطط يومي محترف. رد فقط بـ JSON صالح بدون أي نص إضافي.`

  // أكثر وقت إنتاجية بناءً على السجلات
  const hourlyProd = {}
  timeLogs.filter(l => l.ended_at).forEach(l => {
    const h = new Date(l.started_at).getHours()
    const m = Math.round((new Date(l.ended_at) - new Date(l.started_at)) / 60000)
    hourlyProd[h] = (hourlyProd[h] || 0) + m
  })
  const peakHour = Object.entries(hourlyProd).sort((a,b) => b[1]-a[1])[0]?.[0] || 9

  const text = await callClaude(system, `مهام اليوم (حسب الأولوية):
${tasks.map((t,i) => `${i+1}. ${t.title} (${t.priority === 'high' ? 'عالية' : t.priority === 'medium' ? 'متوسطة' : 'منخفضة'})`).join('\n')}

أوقات الفراغ المتاحة: ${availableSlots.map(s => `${s.from_time}–${s.to_time}`).join(', ')}
أكثر ساعة إنتاجية تاريخياً: ${peakHour}:00
تفضيلات: ${preferences || 'لا يوجد'}

اصنع جدولاً ساعياً مثالياً لليوم.
رد بـ JSON فقط:
{
  "schedule": [
    {
      "time": "09:00",
      "end_time": "09:30",
      "task": "اسم المهمة أو النشاط",
      "type": "work",
      "tip": "نصيحة"
    }
  ],
  "summary": "ملخص اليوم",
  "warning": "تحذير إن وجد"
}`)

  try { return JSON.parse(text.replace(/\`\`\`json|\`\`\`/g, '').trim()) }
  catch { return null }
}

// ==========================================
// Weekly Review
// ==========================================
export async function generateWeeklyReview({ tasks, timeLogs, goals, habits, habitLogs }) {
  const system = `أنت مراجع إنتاجية أسبوعي محترف. رد فقط بـ JSON صالح بدون أي نص إضافي.`
  const weekAgo = new Date(Date.now() - 7*86400000).toISOString().split('T')[0]
  const today   = new Date().toISOString().split('T')[0]

  const weekTasks   = tasks.filter(t => t.due_date >= weekAgo && t.due_date <= today)
  const doneTasks   = weekTasks.filter(t => t.status === 'done')
  const weekLogs    = timeLogs.filter(l => l.started_at >= weekAgo)
  const totalMins   = weekLogs.filter(l=>l.ended_at).reduce((a,l)=>a+Math.round((new Date(l.ended_at)-new Date(l.started_at))/60000),0)
  const habitDone   = habitLogs.filter(l => l.log_date >= weekAgo).length
  const habitTarget = habits.length * 7

  const text = await callClaude(system, `بيانات الأسبوع الماضي:
- المهام المنجزة: ${doneTasks.length} من ${weekTasks.length}
- إجمالي وقت العمل: ${Math.floor(totalMins/60)} ساعة و${totalMins%60} دقيقة
- العادات المكتملة: ${habitDone} من ${habitTarget} (${habitTarget>0?Math.round((habitDone/habitTarget)*100):0}%)
- الأهداف النشطة: ${goals.length}
- أكثر فئة وقتاً: ${getMostCat(weekLogs)}
- المهام المتأخرة: ${tasks.filter(t=>t.due_date<today&&t.status!=='done').length}

اعمل مراجعة أسبوعية شاملة. رد بـ JSON فقط:
{
  "score": 75,
  "grade": "جيد جداً",
  "wins": ["إنجاز 1","إنجاز 2","إنجاز 3"],
  "misses": ["فرصة ضائعة 1","فرصة ضائعة 2"],
  "patterns": "ملاحظة عن أنماط الأسبوع",
  "next_week_focus": "أهم شيء تركز عليه الأسبوع الجاي",
  "next_week_tasks": ["مهمة مقترحة 1","مهمة مقترحة 2","مهمة مقترحة 3"],
  "motivation": "جملة تحفيزية مخصصة"
}`)
  try { return JSON.parse(text.replace(/\`\`\`json|\`\`\`/g,'').trim()) }
  catch { return null }
}

function getMostCat(logs) {
  const m={}; const labels={study:'مذاكرة',work:'عمل',entertainment:'ترفيه',exercise:'رياضة',other:'أخرى'}
  logs.filter(l=>l.ended_at).forEach(l=>{const mins=Math.round((new Date(l.ended_at)-new Date(l.started_at))/60000);m[l.category]=(m[l.category]||0)+mins})
  const top=Object.entries(m).sort((a,b)=>b[1]-a[1])[0]
  return top ? `${labels[top[0]]||top[0]} (${Math.floor(top[1]/60)}س)` : 'لا يوجد'
}

// ==========================================
// Burnout Detector
// ==========================================
export async function detectBurnout({ timeLogs, tasks, habitLogs, habits }) {
  const system = `أنت طبيب إنتاجية متخصص في كشف الإرهاق. رد فقط بـ JSON صالح.`
  const days14 = Array.from({length:14},(_,i)=>new Date(Date.now()-i*86400000).toISOString().split('T')[0])
  
  const dailyMins = days14.map(d=>{
    const dayLogs=timeLogs.filter(l=>l.started_at?.startsWith(d)&&l.ended_at)
    return dayLogs.reduce((a,l)=>a+Math.round((new Date(l.ended_at)-new Date(l.started_at))/60000),0)
  })
  const dailyTasks = days14.map(d=>tasks.filter(t=>t.due_date===d&&t.status==='done').length)
  const habitRate  = days14.map(d=>habits.length>0?Math.round((habitLogs.filter(l=>l.log_date===d).length/habits.length)*100):0)

  const text = await callClaude(system, `بيانات آخر 14 يوم:
وقت العمل اليومي (دقيقة): ${dailyMins.join(', ')}
مهام منجزة يومياً: ${dailyTasks.join(', ')}
معدل العادات اليومي (%): ${habitRate.join(', ')}

حلّل هذه البيانات للكشف عن علامات الإرهاق أو الانحدار.
رد بـ JSON فقط:
{
  "burnout_level": "low",
  "score": 25,
  "trend": "stable",
  "warning_signs": ["علامة 1"],
  "positive_signs": ["علامة إيجابية"],
  "recommendation": "توصية محددة",
  "action": "خطوة عملية واحدة الآن"
}`)
  try { return JSON.parse(text.replace(/\`\`\`json|\`\`\`/g,'').trim()) }
  catch { return null }
}

// ==========================================
// AI Chat
// ==========================================
export async function chatWithAI(messages, context) {
  const system = `أنت مساعد إنتاجية ذكي اسمك "سديم". تتكلم بالعربي بشكل ودود وعملي.
تعرف كل بيانات المستخدم:
- الأهداف: ${context.goals.map(g=>g.title).join(', ')||'لا يوجد'}
- مهام اليوم: ${context.todayTasks.map(t=>t.title).join(', ')||'لا يوجد'}
- وقت العمل اليوم: ${context.todayMins} دقيقة
- نقطة التركيز اليوم: ${context.focusScore}/100
ردودك قصيرة وعملية (3-4 جمل max). لو المستخدم طلب إضافة مهمة أو هدف قوله "سأضيف ذلك" وأعد JSON خاص.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
      'anthropic-version':'2023-06-01',
      'anthropic-dangerous-direct-browser-access':'true',
    },
    body: JSON.stringify({
      model:'claude-haiku-4-5-20251001', max_tokens:512, system,
      messages: messages.map(m=>({role:m.role, content:m.content})),
    }),
  })
  const data = await response.json()
  if(!response.ok) throw new Error(data.error?.message)
  return data.content[0].text
}
