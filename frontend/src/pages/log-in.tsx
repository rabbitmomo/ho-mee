// app/log-in/page.tsx (or pages/log-in.tsx)
import { Suspense, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import ParticlesGlobe from '@/components/ParticlesGlobe'
import { useRouter } from 'next/router' // or 'next/navigation' for App Router

// Default credentials (demo only)
const DEFAULT_EMAIL = 'user@example.com'
const DEFAULT_PASSWORD = 'password'

export default function LoginPage() {
  const router = useRouter()
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [email, setEmail] = useState(DEFAULT_EMAIL)
  const [password, setPassword] = useState(DEFAULT_PASSWORD)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Simple client-side check (case‑insensitive email, exact password)
    if (email.trim().toLowerCase() === DEFAULT_EMAIL.toLowerCase() && password === DEFAULT_PASSWORD) {
      setIsLoggingIn(true)
      // 3‑second animation + redirect
      setTimeout(() => {
        router.push('/dashboard') // or '/' if you prefer
      }, 3000)
    } else {
      setError('Invalid email or password. Use default: user@example.com / password')
    }
  }

  return (
    <main style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', background: 'radial-gradient(circle at top, #f8fbff 0%, #eef4ff 42%, #dfeaff 100%)' }}>
      {/* 3D Globe Background */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        {prefersReducedMotion ? (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', opacity: 0.9 }}>
            <img src="/static/preview-globe.png" alt="Globe preview" style={{ width: 'min(72vw, 760px)', maxWidth: 760, filter: 'drop-shadow(0 20px 80px rgba(37,99,235,0.16))' }} />
          </div>
        ) : (
          <Canvas camera={{ position: [0, 0, 4.1], fov: 50 }} dpr={[1, 1.6]}>
            <ambientLight intensity={0.7} />
            <directionalLight position={[5, 6, 5]} intensity={0.8} />
            <Suspense fallback={<Html>Loading visual…</Html>}>
              <ParticlesGlobe count={5000} radius={2.78} pulseSpeed={3.05} />
            </Suspense>
            <OrbitControls enablePan={false} autoRotate autoRotateSpeed={1.16} minDistance={2.8} maxDistance={6} />
          </Canvas>
        )}
      </div>

      {/* Login Card */}
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ maxWidth: 440, width: '100%', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', borderRadius: 32, padding: 32, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.5)' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Welcome back</h1>
            <p style={{ color: '#334155', marginTop: 8 }}>Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="email" style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 14, border: '1px solid #cbd5e1', background: 'white', fontSize: 16 }}
                required
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label htmlFor="password" style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 14, border: '1px solid #cbd5e1', background: 'white', fontSize: 16 }}
                required
              />
            </div>
            {error && (
              <div style={{ background: '#fee2e2', color: '#b91c1c', padding: 10, borderRadius: 12, marginBottom: 20, fontSize: 14 }}>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={isLoggingIn}
              style={{
                width: '100%', padding: '12px', borderRadius: 40, background: '#2563eb', color: 'white',
                fontWeight: 700, fontSize: 16, border: 'none', cursor: isLoggingIn ? 'wait' : 'pointer',
                transition: 'all 0.2s', opacity: isLoggingIn ? 0.7 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
              }}
            >
              {isLoggingIn ? (
                <>
                  <span className="login-spinner" style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Logging in...
                </>
              ) : (
                'Log in'
              )}
            </button>
          </form>

          <p style={{ fontSize: 12, textAlign: 'center', marginTop: 24, color: '#475569' }}>
            Demo credentials: <strong>{DEFAULT_EMAIL}</strong> / <strong>{DEFAULT_PASSWORD}</strong>
          </p>
        </div>
      </div>

      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  )
}