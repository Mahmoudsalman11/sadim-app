import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import {
  LayoutDashboard, Target, CheckSquare, Clock, Calendar,
  LogOut, Sparkles, BarChart2, Bell, Timer, Brain, Repeat,
  Zap, Sun, Star, MessageCircle, Download, Heart, Shield,
  ShieldOff, Flag
} from 'lucide-react'

const NAV = [
  { label:'اليوم', items:[
    { to:'/',            icon:LayoutDashboard, label:'الرئيسية' },
    { to:'/briefing',    icon:Sun,             label:'ملخص اليوم' },
    { to:'/focus-score', icon:Zap,             label:'نقطة التركيز' },
    { to:'/chat',        icon:MessageCircle,   label:'سَدِيم AI 💬' },
  ]},
  { label:'التخطيط', items:[
    { to:'/smart-planner', icon:Brain,       label:'المخطط الذكي' },
    { to:'/planner',       icon:Calendar,    label:'المخطط الأسبوعي' },
    { to:'/goals',         icon:Target,      label:'أهدافي' },
    { to:'/tasks',         icon:CheckSquare, label:'مهامي' },
    { to:'/habits',        icon:Repeat,      label:'عاداتي' },
    { to:'/milestones',    icon:Flag,        label:'المراحل والإنجازات' },
  ]},
  { label:'التتبع', items:[
    { to:'/focus',        icon:Timer,   label:'وضع التركيز' },
    { to:'/timelog',      icon:Clock,   label:'سجل الوقت' },
    { to:'/availability', icon:Clock,   label:'وقت الفراغ' },
    { to:'/events',       icon:Bell,    label:'المواعيد' },
  ]},
  { label:'التحليل', items:[
    { to:'/analytics',      icon:BarChart2,     label:'التقارير' },
    { to:'/weekly-review',  icon:Star,          label:'المراجعة الأسبوعية' },
    { to:'/burnout',         icon:Heart,      label:'كاشف الإرهاق' },
    { to:'/extension-hub',   icon:Shield,     label:'التحكم بالمتصفح' },
    { to:'/distraction-log', icon:ShieldOff,  label:'سجل المشتتات' },
    { to:'/export',         icon:Download,      label:'تصدير' },
  ]},
]

export default function Layout() {
  const { user, signOut } = useAuthStore()
  const navigate = useNavigate()

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg-base)', position:'relative', zIndex:1 }}>

      {/* ── SIDEBAR ── */}
      <aside style={{
        width: 220,
        background: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border-subtle)',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', right: 0, top: 0, bottom: 0,
        zIndex: 10, overflowY: 'auto',
      }}>

        {/* Logo */}
        <div style={{
          padding: '18px 16px 14px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'linear-gradient(180deg, rgba(240,165,0,0.06) 0%, transparent 100%)',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: 'linear-gradient(135deg, var(--gold), var(--gold-2))',
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow: 'var(--shadow-gold)',
            }}>
              <Sparkles size={16} color="#07091a" />
            </div>
            <div>
              <p style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)', margin:0, lineHeight:1 }}>سَدِيم</p>
              <p style={{ fontSize:9, color:'var(--gold)', margin:0, opacity:0.8, letterSpacing:'0.05em' }}>SADIM</p>
            </div>
          </div>
          <p style={{
            fontSize: 10, color: 'var(--text-muted)',
            margin: 0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
            background: 'var(--bg-overlay)', borderRadius: 6,
            padding: '4px 8px',
          }}>{user?.email}</p>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:'8px 8px 0', overflowY:'auto' }}>
          {NAV.map(({ label, items }) => (
            <div key={label} style={{ marginBottom:16 }}>
              <p style={{
                fontSize: 9, fontWeight: 700, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.12em',
                padding: '0 8px', margin: '0 0 4px',
              }}>{label}</p>
              {items.map(({ to, icon:Icon, label:lbl }) => (
                <NavLink key={to} to={to} end={to==='/'} style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '8px 10px', borderRadius: 8, marginBottom: 1,
                  textDecoration: 'none', fontSize: 12, fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--gold)' : 'var(--text-secondary)',
                  background: isActive ? 'rgba(240,165,0,0.1)' : 'transparent',
                  borderRight: isActive ? '2px solid var(--gold)' : '2px solid transparent',
                  transition: 'all 0.15s',
                })}>
                  <Icon size={13} />
                  {lbl}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Logout */}
        <div style={{ padding:'12px 8px', borderTop:'1px solid var(--border-subtle)' }}>
          <button onClick={async()=>{ await signOut(); navigate('/auth') }} style={{
            display:'flex', alignItems:'center', gap:9, width:'100%',
            padding:'8px 10px', background:'transparent', border:'none',
            borderRadius:8, cursor:'pointer', color:'var(--text-muted)',
            fontSize:12, fontFamily:'var(--font-ar)', transition:'color 0.2s',
          }}
            onMouseEnter={e=>e.currentTarget.style.color='var(--red)'}
            onMouseLeave={e=>e.currentTarget.style.color='var(--text-muted)'}>
            <LogOut size={13} /> تسجيل خروج
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main style={{
        flex: 1, marginRight: 220,
        padding: '32px 40px',
        maxWidth: 'calc(100vw - 220px)',
        position: 'relative', zIndex: 1,
      }}>
        <Outlet />
      </main>
    </div>
  )
}
