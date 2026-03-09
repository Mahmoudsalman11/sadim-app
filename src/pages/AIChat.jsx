import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { chatWithAI } from '../lib/ai'
import { Send, Bot, User, Sparkles, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'

const SUGGESTIONS = [
  'إيه أهم مهمة أركز عليها النهارده؟',
  'كيف كان أسبوعي؟',
  'إيه اللي بيأخذ معظم وقتي؟',
  'أنا تعبان، إيه توصيتك؟',
  'ساعدني أرتب أولوياتي',
]

export default function AIChat() {
  const { user }            = useAuthStore()
  const [messages, setMessages] = useState([])
  const [input, setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const [context, setContext] = useState(null)
  const bottomRef           = useRef(null)
  const inputRef            = useRef(null)

  useEffect(() => { loadContext() }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages])

  async function loadContext() {
    const today = new Date().toISOString().split('T')[0]
    const [g, t, l] = await Promise.all([
      supabase.from('goals').select('*').eq('user_id',user.id).eq('status','active'),
      supabase.from('tasks').select('*').eq('user_id',user.id).eq('due_date',today),
      supabase.from('time_logs').select('*').eq('user_id',user.id).gte('started_at',today),
    ])
    const todayMins = (l.data||[]).filter(x=>x.ended_at).reduce((a,x)=>a+Math.round((new Date(x.ended_at)-new Date(x.started_at))/60000),0)
    const doneTasks = (t.data||[]).filter(x=>x.status==='done').length
    const totalTasks = (t.data||[]).length
    const focusScore = totalTasks > 0 ? Math.round((doneTasks/totalTasks)*40 + Math.min((todayMins/240)*35,35)) : 0
    setContext({ goals:g.data||[], todayTasks:t.data||[], todayMins, focusScore })

    // Welcome message
    setMessages([{
      role:'assistant',
      content:`أهلاً! أنا سديم مساعدك الذكي 🤖\n\nأعرف عنك:\n- عندك **${(g.data||[]).length} هدف** نشط\n- **${doneTasks}/${totalTasks} مهمة** منجزة اليوم\n- شغّلت **${Math.floor(todayMins/60)}س ${todayMins%60}د** النهارده\n\nكلّمني بأي حاجة! 😊`,
      time: new Date(),
    }])
  }

  async function sendMessage(text) {
    const msg = text || input.trim()
    if (!msg || loading) return
    setInput('')

    const userMsg = { role:'user', content:msg, time:new Date() }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    const history = [...messages, userMsg].slice(-10).map(m => ({ role:m.role, content:m.content }))

    try {
      const reply = await chatWithAI(history, context)
      setMessages(prev => [...prev, { role:'assistant', content:reply, time:new Date() }])
    } catch {
      setMessages(prev => [...prev, { role:'assistant', content:'عذراً، حدث خطأ. تأكد من الـ API Key.', time:new Date() }])
    }
    setLoading(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  function formatContent(text) {
    return text.split('\n').map((line, i) => {
      const bold = line.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#f59e0b">$1</strong>')
      return <p key={i} style={{ margin:'0 0 4px', lineHeight:1.6 }} dangerouslySetInnerHTML={{ __html:bold }} />
    })
  }

  return (
    <div className="fade-in" style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 100px)' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#f59e0b,#a855f7)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Bot size={18} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize:16, fontWeight:700, color:'#e2e8f0', margin:0 }}>سديم AI 💬</h1>
            <p style={{ fontSize:11, color:'#22c55e', margin:0, display:'flex', alignItems:'center', gap:4 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'#22c55e', display:'inline-block', animation:'pulse 1.5s infinite' }} />
              متصل ويعرف بياناتك
            </p>
          </div>
        </div>
        <button onClick={() => { setMessages([]); loadContext() }} style={{ background:'none', border:'none', cursor:'pointer', color:'#475569', display:'flex', alignItems:'center', gap:5, fontSize:12 }}
          onMouseEnter={e=>e.currentTarget.style.color='#ef4444'}
          onMouseLeave={e=>e.currentTarget.style.color='#475569'}>
          <Trash2 size={13} /> مسح المحادثة
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:12, paddingBottom:8, scrollbarWidth:'thin', scrollbarColor:'#2a3040 transparent' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start', flexDirection:msg.role==='user'?'row-reverse':'row' }}>
            {/* Avatar */}
            <div style={{ width:32, height:32, borderRadius:8, background:msg.role==='user'?'rgba(245,158,11,0.15)':'linear-gradient(135deg,#f59e0b,#a855f7)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              {msg.role==='user' ? <User size={14} color="#f59e0b" /> : <Bot size={14} color="#fff" />}
            </div>
            {/* Bubble */}
            <div style={{ maxWidth:'75%' }}>
              <div style={{
                background: msg.role==='user'?'rgba(245,158,11,0.1)':'#1e2330',
                border: `1px solid ${msg.role==='user'?'rgba(245,158,11,0.25)':'#2a3040'}`,
                borderRadius: msg.role==='user'?'14px 4px 14px 14px':'4px 14px 14px 14px',
                padding:'12px 14px',
                fontSize:13, color:'#e2e8f0', lineHeight:1.6,
              }}>
                {formatContent(msg.content)}
              </div>
              <p style={{ fontSize:10, color:'#2a3040', margin:'4px 6px 0', textAlign:msg.role==='user'?'left':'right' }}>
                {msg.time ? format(msg.time,'h:mm a') : ''}
              </p>
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#f59e0b,#a855f7)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Bot size={14} color="#fff" />
            </div>
            <div style={{ background:'#1e2330', border:'1px solid #2a3040', borderRadius:'4px 14px 14px 14px', padding:'14px 18px' }}>
              <div style={{ display:'flex', gap:5 }}>
                {[0,1,2].map(i => <div key={i} style={{ width:7, height:7, borderRadius:'50%', background:'#475569', animation:`bounce 1.2s ${i*0.2}s infinite` }} />)}
              </div>
              <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}`}</style>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
          {SUGGESTIONS.map((s,i) => (
            <button key={i} onClick={() => sendMessage(s)} style={{
              padding:'6px 12px', borderRadius:20, fontSize:11, cursor:'pointer',
              background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)',
              color:'#94a3b8', transition:'all 0.15s',
            }}
              onMouseEnter={e=>{e.currentTarget.style.color='#f59e0b';e.currentTarget.style.borderColor='rgba(245,158,11,0.5)'}}
              onMouseLeave={e=>{e.currentTarget.style.color='#94a3b8';e.currentTarget.style.borderColor='rgba(245,158,11,0.2)'}}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ display:'flex', gap:8, background:'#1e2330', border:'1px solid #2a3040', borderRadius:12, padding:'8px 8px 8px 14px', marginTop:4 }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key==='Enter' && !e.shiftKey && sendMessage()}
          placeholder='اكتب رسالتك... (Enter للإرسال)'
          style={{ flex:1, background:'none', border:'none', outline:'none', color:'#e2e8f0', fontSize:13, fontFamily:'IBM Plex Sans Arabic', direction:'rtl' }}
        />
        <button onClick={() => sendMessage()} disabled={loading||!input.trim()} style={{
          width:36, height:36, borderRadius:9, background:input.trim()?'linear-gradient(135deg,#f59e0b,#fbbf24)':'#2a3040',
          border:'none', cursor:input.trim()?'pointer':'default', display:'flex', alignItems:'center', justifyContent:'center',
          transition:'all 0.2s', flexShrink:0,
        }}>
          <Send size={15} color={input.trim()?'#0d0f14':'#475569'} style={{ transform:'rotate(180deg)' }} />
        </button>
      </div>
    </div>
  )
}
