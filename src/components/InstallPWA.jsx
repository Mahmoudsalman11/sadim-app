import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'

export default function InstallPWA() {
  const [prompt, setPrompt]   = useState(null)
  const [show, setShow]       = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
      return
    }

    const handler = (e) => {
      e.preventDefault()
      setPrompt(e)
      setShow(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => setInstalled(true))

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setShow(false)
  }

  if (!show || installed) return null

  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: '#1e2330', border: '1px solid #f59e0b44',
      borderRadius: 14, padding: '14px 18px', zIndex: 1000,
      display: 'flex', alignItems: 'center', gap: 14,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      maxWidth: 340, width: 'calc(100vw - 48px)',
      animation: 'slideUp 0.3s ease',
    }}>
      <div style={{ width: 36, height: 36, background: 'rgba(245,158,11,0.15)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Download size={16} color="#f59e0b" />
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>ثبّت ساديم</p>
        <p style={{ fontSize: 11, color: '#475569', margin: '2px 0 0' }}>استخدمه زي app عادي بدون متصفح</p>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleInstall} style={{
          background: '#f59e0b', color: '#0d0f14', border: 'none',
          borderRadius: 8, padding: '7px 14px', fontSize: 12,
          fontWeight: 600, cursor: 'pointer',
        }}>ثبّت</button>
        <button onClick={() => setShow(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 4 }}>
          <X size={14} />
        </button>
      </div>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  )
}
