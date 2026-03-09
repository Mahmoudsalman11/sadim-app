import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useAuthStore } from './stores/authStore'
import Layout         from './components/Layout'
import InstallPWA     from './components/InstallPWA'
import QuickCapture   from './components/QuickCapture'
import Auth           from './pages/Auth'
import Dashboard      from './pages/Dashboard'
import Goals          from './pages/Goals'
import Tasks          from './pages/Tasks'
import Availability   from './pages/Availability'
import TimeLog        from './pages/TimeLog'
import Analytics      from './pages/Analytics'
import Events         from './pages/Events'
import Focus          from './pages/Focus'
import WeeklyPlanner  from './pages/WeeklyPlanner'
import SmartPlanner   from './pages/SmartPlanner'
import Habits         from './pages/Habits'
import FocusScore     from './pages/FocusScore'
import DailyBriefing  from './pages/DailyBriefing'
import WeeklyReview   from './pages/WeeklyReview'
import BurnoutDetector from './pages/BurnoutDetector'
import AIChat         from './pages/AIChat'
import ExtensionHub from './pages/ExtensionHub'
import DistractionLog from './pages/DistractionLog'
import Milestones from './pages/Milestones'
import Export         from './pages/Export'

function PrivateRoute({ children }) {
  const { user, loading } = useAuthStore()
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0d0f14' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:40, height:40, background:'linear-gradient(135deg,#f59e0b,#fbbf24)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px', fontSize:20 }}>✦</div>
        <p style={{ color:'#f59e0b', fontSize:14, fontFamily:'IBM Plex Sans Arabic' }}>جاري التحميل...</p>
      </div>
    </div>
  )
  return user ? children : <Navigate to="/auth" replace />
}

export default function App() {
  const { setUser, setLoading } = useAuthStore()
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setUser(session?.user??null); setLoading(false) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user??null))
    return () => subscription.unsubscribe()
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index                  element={<Dashboard />} />
          <Route path="briefing"        element={<DailyBriefing />} />
          <Route path="goals"           element={<Goals />} />
          <Route path="tasks"           element={<Tasks />} />
          <Route path="habits"          element={<Habits />} />
          <Route path="availability"    element={<Availability />} />
          <Route path="timelog"         element={<TimeLog />} />
          <Route path="focus"           element={<Focus />} />
          <Route path="smart-planner"   element={<SmartPlanner />} />
          <Route path="planner"         element={<WeeklyPlanner />} />
          <Route path="analytics"       element={<Analytics />} />
          <Route path="focus-score"     element={<FocusScore />} />
          <Route path="weekly-review"   element={<WeeklyReview />} />
          <Route path="burnout"         element={<BurnoutDetector />} />
          <Route path="chat"            element={<AIChat />} />
          <Route path="events"          element={<Events />} />
          <Route path="extension-hub" element={<ExtensionHub />} />
          <Route path="distraction-log" element={<DistractionLog />} />
          <Route path="milestones" element={<Milestones />} />
          <Route path="export"          element={<Export />} />
        </Route>
      </Routes>
      <PrivateRoute><QuickCapture /></PrivateRoute>
      <InstallPWA />
    </BrowserRouter>
  )
}
