import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Sparkles, Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react'

export default function Auth() {
  const [mode, setMode]         = useState('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const navigate = useNavigate()

  const handle = async () => {
    setError(''); setLoading(true)
    try {
      let result
      if (mode === 'login') {
        result = await supabase.auth.signInWithPassword({ email, password })
      } else {
        result = await supabase.auth.signUp({ email, password })
      }
      if (result.error) throw result.error
      navigate('/')
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)', position: 'relative', overflow: 'hidden', padding: 24,
    }}>

      {/* Ambient glow */}
      <div style={{ position:'absolute', top:'15%', left:'50%', transform:'translateX(-50%)', width:500, height:300, borderRadius:'50%', background:'radial-gradient(ellipse, rgba(240,165,0,0.07) 0%, transparent 70%)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:0, right:'10%', width:300, height:200, borderRadius:'50%', background:'radial-gradient(ellipse, rgba(79,156,249,0.05) 0%, transparent 70%)', pointerEvents:'none' }} />

      <div className="fade-in" style={{ width:'100%', maxWidth:420, position:'relative', zIndex:1 }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:40 }}>
          <div style={{
            width:52, height:52, borderRadius:14,
            background:'linear-gradient(135deg, var(--gold), var(--gold-2))',
            display:'flex', alignItems:'center', justifyContent:'center',
            margin:'0 auto 14px', boxShadow:'var(--shadow-gold)',
          }}>
            <Sparkles size={24} color="#07091a" />
          </div>
          <h1 style={{ fontSize:28, fontWeight:800, color:'var(--text-primary)', margin:'0 0 6px', fontFamily:'var(--font-display)' }}>سَدِيم</h1>
          <p style={{ fontSize:13, color:'var(--text-muted)', margin:0 }}>مساعدك الذكي للإنتاجية</p>
        </div>

        {/* Card */}
        <div style={{
          background:'var(--bg-elevated)', border:'1px solid var(--border-default)',
          borderRadius:20, padding:'32px 28px',
          boxShadow:'0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(240,165,0,0.05)',
        }}>

          {/* Mode tabs */}
          <div style={{ display:'flex', background:'var(--bg-surface)', borderRadius:10, padding:3, marginBottom:28, gap:3 }}>
            {[['login','دخول'],['register','حساب جديد']].map(([m, lbl]) => (
              <button key={m} onClick={()=>{ setMode(m); setError('') }} style={{
                flex:1, padding:'8px', borderRadius:8, border:'none', cursor:'pointer',
                fontSize:13, fontWeight:600, fontFamily:'var(--font-ar)',
                background: mode===m ? 'var(--bg-elevated)' : 'transparent',
                color: mode===m ? 'var(--gold)' : 'var(--text-muted)',
                boxShadow: mode===m ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
                transition:'all 0.2s',
              }}>{lbl}</button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div style={{ background:'rgba(240,99,74,0.1)', border:'1px solid rgba(240,99,74,0.2)', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:12, color:'var(--red)' }}>
              {error}
            </div>
          )}

          {/* Email */}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, fontWeight:600, color:'var(--text-secondary)', display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' }}>البريد الإلكتروني</label>
            <div style={{ position:'relative' }}>
              <Mail size={14} color="var(--text-muted)" style={{ position:'absolute', top:'50%', right:12, transform:'translateY(-50%)', pointerEvents:'none' }} />
              <input className="input" type="email" placeholder="you@example.com" value={email}
                onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handle()}
                style={{ paddingRight:36 }} />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom:24 }}>
            <label style={{ fontSize:11, fontWeight:600, color:'var(--text-secondary)', display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' }}>كلمة المرور</label>
            <div style={{ position:'relative' }}>
              <Lock size={14} color="var(--text-muted)" style={{ position:'absolute', top:'50%', right:12, transform:'translateY(-50%)', pointerEvents:'none' }} />
              <input className="input" type={showPass?'text':'password'} placeholder="••••••••" value={password}
                onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handle()}
                style={{ paddingRight:36, paddingLeft:36 }} />
              <button onClick={()=>setShowPass(!showPass)} style={{ position:'absolute', top:'50%', left:10, transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:2 }}>
                {showPass ? <EyeOff size={14}/> : <Eye size={14}/>}
              </button>
            </div>
          </div>

          <button className="btn-primary" onClick={handle} disabled={loading||!email||!password}
            style={{ width:'100%', justifyContent:'center', fontSize:14, padding:'12px' }}>
            {loading ? '...' : mode==='login' ? 'تسجيل الدخول' : 'إنشاء الحساب'}
          </button>
        </div>

        <p style={{ textAlign:'center', fontSize:12, color:'var(--text-muted)', marginTop:20 }}>
          منصة سَدِيم للإنتاجية الذكية 🚀
        </p>
      </div>
    </div>
  )
}
