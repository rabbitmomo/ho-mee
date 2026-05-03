import { Suspense, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import ParticlesGlobe from '@/components/ParticlesGlobe'

export default function LandingPage() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return (
    <main style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', background: 'radial-gradient(circle at top, #f8fbff 0%, #eef4ff 42%, #dfeaff 100%)' }}>
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }} id="visual">
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

      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'grid', alignItems: 'center', padding: 24 }}>
        <section style={{ width: '100%', maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ maxWidth: 620, padding: '20px 6px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, background: 'rgba(37,99,235,0.08)', color: '#1d4ed8', fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>
              Smart Energy System
            </div>
            <h1 style={{ fontSize: 'clamp(40px, 5vw, 64px)', lineHeight: 1.02, margin: '18px 0 14px' }}>Energy visual, placed behind the story.</h1>
            <p style={{ color: '#334155', margin: 0, fontSize: 18, lineHeight: 1.7 }}>
Ho-Mee is a Smart AI-Driven Energy Optimization System that transforms standard household appliances into a self-managing network to eliminate invisible power waste.             </p>
            <div style={{ marginTop: 22, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a href="/log-in" style={{ padding: '12px 18px', borderRadius: 999, background: '#2563eb', color: '#fff', textDecoration: 'none', fontWeight: 700 }}>Log in to dashboard</a>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
