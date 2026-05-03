import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Points, PointsMaterial } from 'three'

type Props = {
  count?: number
  radius?: number
  pulseSpeed?: number
}

export default function ParticlesGlobe({ count = 1200, radius = 1.6, pulseSpeed = 1.0 }: Props) {
  const pointsRef = useRef<Points>(null)
  const materialRef = useRef<PointsMaterial>(null)

  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const color = new THREE.Color()

    for (let i = 0; i < count; i++) {
      const u = Math.random()
      const v = Math.random()
      const theta = 2 * Math.PI * u
      const phi = Math.acos(2 * v - 1)
      const r = radius * (0.88 + Math.random() * 0.22)
      const x = r * Math.sin(phi) * Math.cos(theta)
      const y = r * Math.sin(phi) * Math.sin(theta)
      const z = r * Math.cos(phi)
      positions.set([x, y, z], i * 3)

      // base color gradient (teal -> cyan -> blue)
      color.setHSL(0.55 + Math.random() * 0.08, 0.7, 0.55 - Math.random() * 0.12)
      colors.set([color.r, color.g, color.b], i * 3)
    }

    return { positions, colors }
  }, [count, radius])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * pulseSpeed
    if (!pointsRef.current) return

    // Keep the geometry stable so particles never drift off-screen.
    // Animate the group and material instead of mutating vertex positions.
    pointsRef.current.rotation.y = t * 0.18
    pointsRef.current.rotation.x = Math.sin(t * 0.18) * 0.08

    if (materialRef.current) {
      materialRef.current.size = 0.028 + 0.01 * (0.5 + 0.5 * Math.sin(t * 1.1))
      materialRef.current.opacity = 0.78 + 0.18 * (0.5 + 0.5 * Math.sin(t * 0.8))
    }
  })

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry attach="geometry">
        <bufferAttribute attach="attributes-position" array={positions} itemSize={3} count={positions.length / 3} />
        <bufferAttribute attach="attributes-color" array={colors} itemSize={3} count={colors.length / 3} />
      </bufferGeometry>
      <pointsMaterial ref={materialRef} attach="material" vertexColors size={0.03} sizeAttenuation depthWrite={false} transparent opacity={0.95} blending={THREE.AdditiveBlending} />
    </points>
  )
}
