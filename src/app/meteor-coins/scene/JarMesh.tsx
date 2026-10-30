'use client'

import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'

import { FIELD_FRONT_Z, FIELD_HALF_WIDTH } from '@/app/meteor-coins/lib/cabinet'
import type { DropGame } from '@/app/meteor-coins/lib/game'
import { OBJECTS } from '@/app/meteor-coins/lib/objects'
import { PALETTE } from '@/app/meteor-coins/scene/palette'

/**
 * The jar under the lip (Moonstone Porch): the chute, drawn as a wide glass
 * jar whose open mouth is the table's front edge. Everything off the front
 * falls in. Each special object collected so far rests inside it, glowing,
 * so the jar fills up as the goal does. Its size is kept in step with the
 * crane's camera points (lib/deliveries, cranePoints).
 */
export const JAR = { halfWidth: FIELD_HALF_WIDTH + 0.2, depth: 1.2, top: -0.05, bottom: -1.6 }

export function JarMesh({ game }: { game: DropGame }) {
  const stones = useRef<(THREE.Group | null)[]>([])
  const goal = game.stage.rules.goal
  const id = goal.type === 'collect' ? goal.object : null
  const total = goal.type === 'collect' ? goal.total : 0
  const spec = id ? OBJECTS[id as keyof typeof OBJECTS] : undefined

  useFrame(() => {
    const got = id ? (game.state.collected[id] ?? 0) : 0
    stones.current.forEach((s, i) => {
      if (s) s.visible = i < got
    })
  })

  const height = JAR.top - JAR.bottom
  const midZ = FIELD_FRONT_Z + JAR.depth / 2 + 0.05
  const midY = (JAR.top + JAR.bottom) / 2
  const radius = spec?.reach ?? 0.8
  return (
    <group>
      {/* The glass: a front pane, two ends and a floor, open at the top. */}
      <mesh position={[0, midY, FIELD_FRONT_Z + JAR.depth + 0.05]}>
        <boxGeometry args={[JAR.halfWidth * 2, height, 0.06]} />
        <meshStandardMaterial
          color={PALETTE.jar}
          transparent
          opacity={0.22}
          roughness={0.1}
          metalness={0.1}
        />
      </mesh>
      {[-1, 1].map(side => (
        <mesh key={side} position={[side * JAR.halfWidth, midY, midZ]}>
          <boxGeometry args={[0.06, height, JAR.depth]} />
          <meshStandardMaterial color={PALETTE.jar} transparent opacity={0.22} roughness={0.1} />
        </mesh>
      ))}
      <mesh position={[0, JAR.bottom, midZ]}>
        <boxGeometry args={[JAR.halfWidth * 2, 0.08, JAR.depth]} />
        <meshStandardMaterial color={PALETTE.jar} transparent opacity={0.35} roughness={0.1} />
      </mesh>
      {/* A brass rim round the mouth, and a band of twine round its middle. */}
      <mesh position={[0, JAR.top, FIELD_FRONT_Z + JAR.depth + 0.05]}>
        <boxGeometry args={[JAR.halfWidth * 2 + 0.1, 0.12, 0.12]} />
        <meshStandardMaterial color={PALETTE.jarLid} metalness={0.6} roughness={0.35} />
      </mesh>
      {[-1, 1].map(side => (
        <mesh key={side} position={[side * JAR.halfWidth, JAR.top, midZ]}>
          <boxGeometry args={[0.12, 0.12, JAR.depth + 0.1]} />
          <meshStandardMaterial color={PALETTE.jarLid} metalness={0.6} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[0, midY - 0.2, FIELD_FRONT_Z + JAR.depth + 0.09]}>
        <boxGeometry args={[JAR.halfWidth * 2, 0.08, 0.02]} />
        <meshStandardMaterial color={PALETTE.pageEdge} roughness={0.9} />
      </mesh>
      {/* The ones collected, lying in a row along the bottom. */}
      {Array.from({ length: total }, (_, i) => {
        const x = -JAR.halfWidth + 0.55 + ((JAR.halfWidth * 2 - 1.1) * (i + 0.5)) / total
        return (
          <group
            key={i}
            ref={g => {
              stones.current[i] = g
            }}
            position={[x, JAR.bottom + 0.2 + (i % 2) * 0.05, midZ]}
            rotation={[-0.5, 0, (i % 3) * 0.12 - 0.12]}
            visible={false}
          >
            <mesh>
              <cylinderGeometry args={[Math.min(radius, 0.42), Math.min(radius, 0.42), 0.16, 24]} />
              <meshStandardMaterial
                color={PALETTE.moonstone}
                emissive={PALETTE.moonstone}
                emissiveIntensity={0.7}
              />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
