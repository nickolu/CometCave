'use client'

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

import type { Drain } from '@/app/meteor-coins/lib/engine'
import { PALETTE } from '@/app/meteor-coins/scene/palette'
import { usePrefersReducedMotion } from '@/app/meteor-coins/scene/reducedMotion'

/** Spiral arms in the whirlpool, and how fast it turns (radians a second). */
const ARMS = 3
const TURN_RATE = 0.9

/**
 * A drain in the tub floor: a dark hole with a grate across it, and a
 * whirlpool around it out to the edge of its pull, so you can see how close
 * a duck has to drift before it's dragged in. The whirlpool turns the way
 * the water does; with reduced motion it holds still.
 */
export function DrainMesh({ drain }: { drain: Drain }) {
  const whirl = useRef<THREE.Group>(null)
  const reduced = usePrefersReducedMotion()
  const arm = useMemo(() => spiralArm(drain.size / 2, drain.swirl.radius), [drain])
  const hole = drain.size / 2

  useFrame((_, delta) => {
    if (!whirl.current || reduced) return
    // Seen from above, positive spin turns anticlockwise: +y rotation.
    whirl.current.rotation.y += Math.sign(drain.swirl.spin) * TURN_RATE * Math.min(delta, 0.1)
  })

  return (
    <group position={[drain.x, 0, drain.z]}>
      <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[drain.size, drain.size]} />
        <meshBasicMaterial color={PALETTE.drain} />
      </mesh>
      {/* The grate: a square rim round the hole (a ring of four sides), and two bars across it. */}
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[hole * Math.SQRT2, hole * Math.SQRT2 * 1.15, 4, 1, Math.PI / 4]} />
        <meshStandardMaterial color={PALETTE.tub} metalness={0.6} roughness={0.3} />
      </mesh>
      {[0, Math.PI / 2].map(r => (
        <mesh key={r} position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, r]}>
          <planeGeometry args={[drain.size, 0.05]} />
          <meshStandardMaterial color={PALETTE.tub} metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
      <group ref={whirl} position={[0, 0.008, 0]}>
        {Array.from({ length: ARMS }, (_, i) => (
          <mesh key={i} geometry={arm} rotation={[0, (i * 2 * Math.PI) / ARMS, 0]}>
            <meshBasicMaterial
              color={PALETTE.splash}
              transparent
              opacity={0.35}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** One arm of the whirlpool: a ribbon lying flat, curling in from `outer` to `inner`. */
function spiralArm(inner: number, outer: number): THREE.BufferGeometry {
  const steps = 32
  const positions: number[] = []
  const index: number[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const r = outer + (inner - outer) * t
    // Curls a little over half a turn, and narrows as it nears the hole.
    const a = t * Math.PI * 1.1
    const w = 0.12 * (1 - t) + 0.03
    for (const side of [-1, 1]) {
      const rr = r + side * w
      positions.push(rr * Math.cos(a), 0, -rr * Math.sin(a))
    }
    if (i < steps) {
      const k = i * 2
      index.push(k, k + 1, k + 2, k + 1, k + 3, k + 2)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setIndex(index)
  return g
}
