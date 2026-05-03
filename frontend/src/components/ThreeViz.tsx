import { Canvas } from '@react-three/fiber'
import { useRef, useEffect } from 'react'

function Box({ scale = 1, color = '#2563eb' }: { scale?: number; color?: string }) {
  const ref = useRef<any>()

  useEffect(() => {
    let frame = 0
    const id = requestAnimationFrame(function rotate() {
      frame++
      if (ref.current) ref.current.rotation.y = frame * 0.01
      requestAnimationFrame(rotate)
    })
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <mesh ref={ref} scale={[scale, scale, scale]}>
      <boxGeometry args={[1.6, 1.6, 1.6]} />
      <meshStandardMaterial color={color} metalness={0.4} roughness={0.2} />
    </mesh>
  )
}

export default function ThreeViz({ value = 1000 }: { value?: number }) {
  // scale cube with value (normalize)
  const scale = Math.min(2.6, Math.max(0.6, value / 1200))
  const color = value > 1500 ? '#ef4444' : value > 800 ? '#f59e0b' : '#10b981'

  return (
    <div style={{ width: '100%', height: 220, borderRadius: 12, overflow: 'hidden' }}>
      <Canvas camera={{ position: [0, 0, 4.3], fov: 50 }}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[5, 5, 5]} intensity={0.6} />
        <Box scale={scale} color={color} />
      </Canvas>
    </div>
  )
}
