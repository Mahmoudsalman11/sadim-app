import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Trophy, Zap, Terminal, Server, Cpu, Lock } from 'lucide-react'

export default function HackerRoom({ user }) {
  const [xp, setXp] = useState(0)
  const [loading, setLoading] = useState(true)
  
  // مستويات التطور
  const LEVEL_THRESHOLDS = [
    { level: 1, xp: 0,    title: 'مبتدئ (Script Kiddie)', desc: 'غرفة فارغة.. البداية صعبة' },
    { level: 2, xp: 100,  title: 'هاوي (Grey Hat)',       desc: 'ظهر المكتب واللابتوب!' },
    { level: 3, xp: 300,  title: 'محترف (White Hat)',     desc: 'شاشات متعددة وسيرفرات' },
    { level: 4, xp: 600,  title: 'نخبة (Elite Hacker)',   desc: 'نظام Matrix وإضاءة نيون' },
    { level: 5, xp: 1000, title: 'أسطورة (Cyber God)',    desc: 'المقر كامل التجهيز 🏆' }
  ]

  useEffect(() => {
    async function calcXP() {
      const { count: tasksCount } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'done')
      const { data: logs } = await supabase.from('time_logs').select('started_at, ended_at').eq('user_id', user.id).not('ended_at', 'is', null)
      
      const totalMinutes = logs?.reduce((acc, log) => acc + Math.round((new Date(log.ended_at) - new Date(log.started_at)) / 60000), 0) || 0
      const totalXP = (tasksCount * 20) + Math.floor(totalMinutes / 60 * 50)
      
      setXp(totalXP)
      setLoading(false)
    }
    calcXP()
  }, [user])

  const currentLevel = LEVEL_THRESHOLDS.slice().reverse().find(l => xp >= l.xp) || LEVEL_THRESHOLDS[0]
  const nextLevel = LEVEL_THRESHOLDS.find(l => l.xp > xp)
  const currentThreshold = LEVEL_THRESHOLDS.find(l => l.level === currentLevel.level).xp
  const nextThreshold = nextLevel ? nextLevel.xp : currentThreshold + 1000
  const progressToNext = Math.min(100, Math.max(0, ((xp - currentThreshold) / (nextThreshold - currentThreshold)) * 100))

  if (loading) return <div className="card animate-pulse" style={{height: 300}}></div>

  return (
    <div className="card" style={{ 
      position: 'relative', overflow: 'hidden', minHeight: '320px', padding: 0, 
      border: '1px solid #1e293b', background: '#020617' 
    }}>
      
      {/* 1. الخلفية (الرسم التفاعلي) */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        
        {/* تأثير التوهج العلوي */}
        <div style={{ position: 'absolute', top: '-50%', left: '50%', transform: 'translateX(-50%)', width: '80%', height: '80%', background: 'radial-gradient(circle, rgba(34,211,238,0.15) 0%, transparent 70%)', filter: 'blur(60px)' }}></div>

        {/* الأرضية الشبكية (Grid Floor) - بتدي شكل 3D */}
        <div style={{ 
          position: 'absolute', bottom: 0, width: '100%', height: '40%', 
          background: `
            linear-gradient(transparent 0%, rgba(14, 165, 233, 0.1) 100%),
            repeating-linear-gradient(90deg, transparent 0, transparent 40px, rgba(14, 165, 233, 0.1) 41px),
            repeating-linear-gradient(0deg, transparent 0, transparent 40px, rgba(14, 165, 233, 0.1) 41px)
          `,
          transform: 'perspective(500px) rotateX(60deg) scale(1.5)',
          transformOrigin: 'bottom center',
          opacity: 0.6
        }}></div>
        
        {/* العناصر الرسومية حسب المستوى */}
        <div style={{ position: 'absolute', bottom: 40, left: 0, right: 0, height: 200, display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
          
          {/* Level 2: المكتب واللابتوب */}
          {currentLevel.level >= 2 && (
            <div style={{ position: 'relative', width: 220, height: 10, background: '#334155', borderRadius: 4, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 10 }}>
               {/* لابتوب */}
               <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', width: 100, height: 65, background: '#1e293b', borderRadius: '6px 6px 0 0', border: '1px solid #475569', borderBottom: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {/* شعار أبل المضئ */}
                  <div style={{ width: 12, height: 12, background: '#fff', borderRadius: '50%', opacity: 0.8, boxShadow: '0 0 10px #fff' }}></div>
               </div>
               {/* انعكاس اللابتوب */}
               <div style={{ position: 'absolute', bottom: -65, left: '50%', transform: 'translateX(-50%) scaleY(-1)', width: 100, height: 65, background: 'linear-gradient(to top, rgba(30, 41, 59, 0.3), transparent)', borderRadius: '6px 6px 0 0', opacity: 0.3 }}></div>
            </div>
          )}

          {/* Level 3: الشاشات الجانبية */}
          {currentLevel.level >= 3 && (
            <>
              <div style={{ position: 'absolute', bottom: 50, left: '20%', width: 70, height: 100, background: '#0f172a', border: '2px solid #0ea5e9', borderRadius: 6, transform: 'rotateY(25deg)', boxShadow: '0 0 15px rgba(14, 165, 233, 0.3)' }}>
                <div style={{ width: '100%', height: '100%', background: 'linear-gradient(45deg, transparent 40%, rgba(14, 165, 233, 0.2) 50%, transparent 60%)', animation: 'scan 3s infinite linear' }}></div>
              </div>
              <div style={{ position: 'absolute', bottom: 50, right: '20%', width: 70, height: 100, background: '#0f172a', border: '2px solid #0ea5e9', borderRadius: 6, transform: 'rotateY(-25deg)', boxShadow: '0 0 15px rgba(14, 165, 233, 0.3)' }}></div>
            </>
          )}

          {/* Level 4: السيرفرات */}
          {currentLevel.level >= 4 && (
             <div style={{ position: 'absolute', top: -50, right: '10%', width: 40, height: 200, background: '#020617', border: '1px solid #1e293b', zIndex: 5 }}>
                {[1,2,3,4].map(i => (
                  <div key={i} style={{ width: '80%', height: 4, background: '#22c55e', margin: '10px auto', boxShadow: '0 0 8px #22c55e', animation: `blink ${Math.random()*2}s infinite` }}></div>
                ))}
             </div>
          )}

          {/* Level 5: الكأس والاحتفال */}
          {currentLevel.level >= 5 && (
            <div style={{ position: 'absolute', top: -80, zIndex: 20, animation: 'float 3s ease-in-out infinite' }}>
               <Trophy size={50} color="#fbbf24" fill="#fbbf24" style={{ filter: 'drop-shadow(0 0 30px #fbbf24)' }} />
            </div>
          )}
        </div>
      </div>

      {/* 2. واجهة المعلومات (UI Overlay) */}
      <div style={{ position: 'relative', zIndex: 10, padding: 24, background: 'linear-gradient(180deg, rgba(2,6,23,0.9) 0%, transparent 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
              {currentLevel.level >= 4 ? <Cpu color="#22d3ee" size={20} /> : <Terminal color="#94a3b8" size={20} />}
              {currentLevel.title}
            </h3>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#94a3b8' }}>{currentLevel.desc}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: '#22d3ee', fontFamily: 'monospace' }}>{xp}</span>
            <span style={{ fontSize: 11, color: '#64748b', display: 'block', textTransform: 'uppercase', letterSpacing: 1 }}>XP Points</span>
          </div>
        </div>

        {/* شريط التقدم */}
        {nextLevel && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569', marginBottom: 8, fontFamily: 'monospace' }}>
              <span>LVL {currentLevel.level}</span>
              <span>NEXT: {nextThreshold - xp} XP</span>
              <span>LVL {currentLevel.level + 1}</span>
            </div>
            <div style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${progressToNext}%`, height: '100%', background: 'linear-gradient(90deg, #0ea5e9, #22d3ee)', transition: 'width 1s ease-out', boxShadow: '0 0 20px rgba(34, 211, 238, 0.4)' }}></div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  )
}