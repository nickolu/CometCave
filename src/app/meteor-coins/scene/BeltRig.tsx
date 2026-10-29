'use client'

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

import { PUSHER_HEIGHT, WALL_HEIGHT } from '@/app/meteor-coins/lib/cabinet'
import type { BeltDelivery } from '@/app/meteor-coins/lib/deliveries/belt'
import type { DropGame } from '@/app/meteor-coins/lib/game'
import { Bramble, prefersReducedMotion } from '@/app/meteor-coins/scene/Bramble'
import { PALETTE } from '@/app/meteor-coins/scene/palette'

/** Chocolates the belt can show at once. */
const MAX_ON_BELT = 8
const CHOC_SIDE = 0.8
const CHOC_HEIGHT = 0.2
const BELT_DEPTH = 1.1
const BELT_THICK = 0.14
/** Ridges across the belt, so it reads as moving even when it's empty. */
const RIDGE_EVERY = 0.6
/** How long an opened trapdoor shows as an open hatch, in seconds of stage clock. */
const HATCH_OPEN_S = 0.35
/** Dots down from the marked chocolate to where it would land. */
const DROP_DOTS = 6

/**
 * Bramble's Midnight Snack's bakery belt: the oven on the left, the belt of
 * trapdoors high over the back of the shelf, the chocolates riding it, and
 * the marker on the one a press drops: an arrow over it, a dotted line down,
 * and a square on the shelf where it would land, filled in when it would
 * land on bare shelf. Draws Bramble too, where the stage's chute roams.
 * Reads the game every frame; owns no game state.
 */
export function BeltRig({ game, belt }: { game: DropGame; belt: BeltDelivery }) {
  const c = belt.config
  const chocs = useRef<THREE.InstancedMesh>(null)
  const marks = useRef<THREE.InstancedMesh>(null)
  const ridges = useRef<THREE.InstancedMesh>(null)
  const hatches = useRef<THREE.InstancedMesh>(null)
  const marker = useRef<THREE.Group>(null)
  const landFill = useRef<THREE.Mesh>(null)
  const still = useMemo(() => prefersReducedMotion(), [])
  const scratch = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      hidden: new THREE.Matrix4().makeScale(0, 0, 0),
    }),
    []
  )
  const length = c.toX - c.fromX
  const ridgeCount = Math.floor(length / RIDGE_EVERY)
  const top = c.y - CHOC_HEIGHT / 2
  const shelfY = PUSHER_HEIGHT + 0.03

  useFrame(() => {
    const s = scratch
    const on = belt.chocolates()
    for (let i = 0; i < MAX_ON_BELT; i++) {
      const p = on[i]
      const mat = p ? s.m.makeTranslation(p.x, p.y, p.z) : s.hidden
      chocs.current?.setMatrixAt(i, mat)
      marks.current?.setMatrixAt(i, mat)
    }
    if (chocs.current) chocs.current.instanceMatrix.needsUpdate = true
    if (marks.current) marks.current.instanceMatrix.needsUpdate = true

    // The belt's ridges ride along with it; held still for reduced motion.
    const shift = still ? 0 : (c.speed * game.dropperTime) % RIDGE_EVERY
    for (let i = 0; i < ridgeCount; i++) {
      const x = c.fromX + shift + i * RIDGE_EVERY
      ridges.current?.setMatrixAt(i, s.m.makeTranslation(x, top + 0.005, c.z))
    }
    if (ridges.current) ridges.current.instanceMatrix.needsUpdate = true

    // Trapdoors just opened: a dark hatch where each chocolate went through.
    const recent = belt.opened.filter(o => game.dropperTime - o.at < HATCH_OPEN_S)
    for (let i = 0; i < 4; i++) {
      const o = recent[i]
      hatches.current?.setMatrixAt(i, o ? s.m.makeTranslation(o.x, top + 0.01, c.z) : s.hidden)
    }
    if (hatches.current) hatches.current.instanceMatrix.needsUpdate = true

    const next = game.canDrop ? belt.next() : null
    if (marker.current) {
      marker.current.visible = next !== null
      if (next) marker.current.position.x = next.x
    }
    if (landFill.current) landFill.current.visible = belt.landsClear
  })

  return (
    <>
      {/* The belt: a row of trapdoor panels on two posts at the ends. */}
      <mesh position={[(c.fromX + c.toX) / 2, top - BELT_THICK / 2, c.z]}>
        <boxGeometry args={[length, BELT_THICK, BELT_DEPTH]} />
        <meshStandardMaterial color={PALETTE.belt} />
      </mesh>
      <instancedMesh ref={ridges} args={[undefined, undefined, ridgeCount]} frustumCulled={false}>
        <boxGeometry args={[0.05, 0.012, BELT_DEPTH * 0.92]} />
        <meshStandardMaterial color={PALETTE.beltRidge} />
      </instancedMesh>
      <instancedMesh ref={hatches} args={[undefined, undefined, 4]} frustumCulled={false}>
        <boxGeometry args={[CHOC_SIDE + 0.1, 0.02, BELT_DEPTH * 0.8]} />
        <meshBasicMaterial color={PALETTE.hatch} />
      </instancedMesh>
      {[c.fromX + 0.3, c.toX - 0.2].map(x => (
        <mesh key={x} position={[x, (top + WALL_HEIGHT) / 2, c.z - BELT_DEPTH / 2]}>
          <boxGeometry args={[0.12, top - WALL_HEIGHT, 0.12]} />
          <meshStandardMaterial color={PALETTE.beltRidge} />
        </mesh>
      ))}

      {/* The oven: a brick box with a glowing mouth facing the belt, and a chimney. */}
      <group position={[c.fromX - 0.45, top, c.z]}>
        <mesh position={[0, 0.45, 0]}>
          <boxGeometry args={[1.1, 1.2, BELT_DEPTH + 0.3]} />
          <meshStandardMaterial color={PALETTE.oven} roughness={0.9} />
        </mesh>
        <mesh position={[0.56, 0.2, 0]}>
          <boxGeometry args={[0.02, 0.4, CHOC_SIDE + 0.2]} />
          <meshStandardMaterial
            color={PALETTE.ovenGlow}
            emissive={PALETTE.ovenGlow}
            emissiveIntensity={0.8}
          />
        </mesh>
        <mesh position={[-0.2, 1.3, -0.2]}>
          <boxGeometry args={[0.3, 0.6, 0.3]} />
          <meshStandardMaterial color={PALETTE.oven} roughness={0.9} />
        </mesh>
      </group>
      {/* The far end: a little hood that takes undropped chocolates back to the oven. */}
      <mesh position={[c.toX + 0.25, top + 0.3, c.z]}>
        <boxGeometry args={[0.6, 0.7, BELT_DEPTH + 0.1]} />
        <meshStandardMaterial color={PALETTE.oven} roughness={0.9} />
      </mesh>

      <instancedMesh ref={chocs} args={[undefined, undefined, MAX_ON_BELT]} frustumCulled={false}>
        <boxGeometry args={[CHOC_SIDE, CHOC_HEIGHT, CHOC_SIDE]} />
        <meshStandardMaterial color={PALETTE.chocolate} roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={marks} args={[undefined, undefined, MAX_ON_BELT]} frustumCulled={false}>
        <boxGeometry args={[CHOC_SIDE * 0.8, CHOC_HEIGHT + 0.02, 0.06]} />
        <meshStandardMaterial color={PALETTE.chocolateMark} />
      </instancedMesh>

      {/* The marked chocolate: an arrow over it, dots down, and its landing square. */}
      <group ref={marker} position={[0, 0, c.z]}>
        <mesh position={[0, c.y + 0.75, 0]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.28, 0.45, 3]} />
          <meshBasicMaterial color={PALETTE.cue} />
        </mesh>
        {Array.from({ length: DROP_DOTS }, (_, i) => {
          const y = top - 0.35 - ((top - 0.35 - shelfY - 0.3) * i) / (DROP_DOTS - 1)
          return (
            <mesh key={i} position={[0, y, 0]}>
              <sphereGeometry args={[0.05, 8, 6]} />
              <meshBasicMaterial color={PALETTE.cue} transparent opacity={0.7} />
            </mesh>
          )
        })}
        <group position={[0, shelfY, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
          <mesh renderOrder={11}>
            <ringGeometry args={[0.42, 0.52, 4, 1]} />
            <meshBasicMaterial
              color={PALETTE.cue}
              transparent
              opacity={0.85}
              depthTest={false}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* Filled in when a drop now would land on bare shelf. */}
          <mesh ref={landFill} renderOrder={11}>
            <circleGeometry args={[0.4, 4]} />
            <meshBasicMaterial
              color={PALETTE.cue}
              transparent
              opacity={0.5}
              depthTest={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      </group>

      {game.engine.chuteSweep && <Bramble game={game} />}
    </>
  )
}
