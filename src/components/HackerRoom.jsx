// src/components/HackerRoom.jsx
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
      // 1. حساب المهام المنجزة (كل مهمة = 20 نقطة)
      const { count: tasksCount } = await supabase
        .from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'done')
      
      // 2. حساب ساعات التركيز (كل ساعة = 50 نقطة)
      const { data: logs } = await supabase
        .from('time_logs').select('started_at, ended_at').eq('user_id', user.id).not('ended_at', 'is', null)
      
      const totalMinutes = logs?.reduce((acc, log) => {
        return acc + Math.round((new Date(log.ended_at) - new Date(log.started_at)) / 60000)
      }, 0) || 0

      const totalXP = (tasksCount * 20) + Math.floor(totalMinutes / 60 * 50)
      setXp(totalXP)
      setLoading(false)
    }
    calcXP()
  }, [user])

  const currentLevel = LEVEL_THRESHOLDS.reverse().find(l => xp >= l.xp) || LEVEL_THRESHOLDS[4]
  const nextLevel = LEVEL_THRESHOLDS.find(l => l.xp > xp)
  const progressToNext = nextLevel 
    ? ((xp - (LEVEL_THRESHOLDS.find(l => l.level === currentLevel.level).xp)) / (nextLevel.xp - (LEVEL_THRESHOLDS.find(l => l.level === currentLevel.level).xp))) * 100
    : 100

  if (loading) return <div className="card animate-pulse" style={{height: 200}}></div>

  return (
    <div className="card" style={{ position: 'relative', overflow: 'hidden', minHeight: '300px', padding: 0, border: '1px solid var(--border-subtle)' }}>
      
      {/* 1. الخلفية (الرسم التفاعلي) */}
      <div style={{ position: 'absolute', inset: 0, background: '#0f172a', zIndex: 0 }}>
        {/* شبكة أرضية (Grid) - موجودة دائماً */}
        <div style={{ position: 'absolute', bottom: 0, width: '100%', height: '50%', background: 'linear-gradient(transparent 0%, rgba(34, 211, 238, 0.1) 100%)', transform: 'perspective(500px) rotateX(60deg)' }}></div>
        
        {/* Level 2: المكتب */}
        {currentLevel.level >= 2 && (
          <div style={{ position: 'absolute', bottom: '20%', left: '50%', transform: 'translateX(-50%)', width: 200, height: 10, background: '#334155', borderRadius: 4, boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}>
             <div style={{ position: 'absolute', bottom: 10, left: 20, width: 160, height: 80, background: '#1e293b', borderRadius: '8px 8px 0 0' }}></div>
          </div>
        )}

        {/* Level 3: الشاشات */}
        {currentLevel.level >= 3 && (
          <>
            <div style={{ position: 'absolute', bottom: '35%', left: '40%', width: 60, height: 40, background: '#0ea5e9', borderRadius: 4, boxShadow: '0 0 15px #0ea5e9', opacity: 0.8 }}></div>
            <div style={{ position: 'absolute', bottom: '35%', left: '55%', width: 60, height: 40, background: '#0ea5e9', borderRadius: 4, boxShadow: '0 0 15px #0ea5e9', opacity: 0.8 }}></div>
          </>
        )}

        {/* Level 4: السيرفرات والنيون */}
        {currentLevel.level >= 4 && (
          <>
            <div style={{ position: 'absolute', top: '20%', left: '10%', width: 40, height: 150, background: '#1e293b', borderRight: '2px solid #22c55e' }}>
               <div style={{ width: '100%', height: 5, background: '#22c55e', marginTop: 10, boxShadow: '0 0 10px #22c55e' }}></div>
               <div style={{ width: '100%', height: 5, background: '#22c55e', marginTop: 20, boxShadow: '0 0 10px #22c55e' }}></div>
            </div>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'repeating-linear-gradient(0deg, transparent, transparent 19px, rgba(34, 211, 238, 0.05) 20px)', pointerEvents: 'none' }}></div>
          </>
        )}

        {/* Level 5: الكأس الذهبي والهالة */}
        {currentLevel.level >= 5 && (
          <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)' }}>
             <Trophy size={40} color="#fbbf24" style={{ filter: 'drop-shadow(0 0 20px #fbbf24)' }} />
          </div>
        )}
      </div>

      {/* 2. واجهة المعلومات (UI Overlay) */}
      <div style={{ position: 'relative', zIndex: 10, padding: 24, background: 'linear-gradient(180deg, rgba(15,23,42,0.9) 0%, transparent 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
              {currentLevel.level >= 4 ? <Cpu color="#22d3ee" /> : <Terminal color="#94a3b8" />}
              {currentLevel.title}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>{currentLevel.desc}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: '#22d3ee' }}>{xp}</span>
            <span style={{ fontSize: 12, color: '#64748b', display: 'block' }}>XP Points</span>
          </div>
        </div>

        {/* شريط التقدم */}
        {nextLevel && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 6 }}>
              <span>Lvl {currentLevel.level}</span>
              <span>Next: {nextLevel.xp - xp} XP needed</span>
              <span>Lvl {currentLevel.level + 1}</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${progressToNext}%`, height: '100%', background: 'var(--blue)', transition: 'width 1s ease-out', boxShadow: '0 0 10px var(--blue)' }}></div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}