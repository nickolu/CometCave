'use client'

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

import type { SlideDelivery } from '@/app/meteor-coins/lib/deliveries/slide'
import type { DropGame } from '@/app/meteor-coins/lib/game'
import { PALETTE } from '@/app/meteor-coins/scene/palette'
import { usePrefersReducedMotion } from '@/app/meteor-coins/scene/reducedMotion'

/** Dots along the path a duck would fly, one every this many physics steps. */
const DOT_EVERY = 2
const MAX_DOTS = 40
/** The slide's trough: half its width, how deep its middle dips, how high its rails stand. */
const HALF_WIDTH = 0.55
const DIP = 0.12
const RAIL = 0.28
/** How long a splash ring spreads, and how far. */
const SPLASH_S = 0.6
const SPLASH_RADIUS = 1.1

/**
 * Rubber Ducky Rumble's waterslide: the slide swaying from its platform at
 * the back of the tub, the next duck waiting at the top, the dotted path a
 * duck sent now would fly with a ring where it lands, and a splash where
 * the last one hit the water. Reads the game every frame; owns no state.
 */
export function SlideRig({ game, slide }: { game: DropGame; slide: SlideDelivery }) {
  const c = slide.config
  const turn = useRef<THREE.Group>(null)
  const waiting = useRef<THREE.Group>(null)
  const dots = useRef<THREE.InstancedMesh>(null)
  const marker = useRef<THREE.Group>(null)
  const splash = useRef<THREE.Mesh>(null)
  const splashMaterial = useRef<THREE.MeshBasicMaterial>(null)
  const reduced = usePrefersReducedMotion()
  const trough = useMemo(() => troughGeometry(slide.points, c.pivot.y), [slide, c.pivot.y])
  const lip = slide.points[slide.points.length - 1]
  const scratch = useMemo(
    () => ({ m: new THREE.Matrix4(), hidden: new THREE.Matrix4().makeScale(0, 0, 0) }),
    []
  )

  useFrame(() => {
    turn.current?.rotation.set(0, slide.yaw, 0)
    const ready = slide.ready
    if (waiting.current) waiting.current.visible = ready
    const path = ready ? slide.previewPath() : []
    const mesh = dots.current
    if (mesh) {
      for (let i = 0; i < MAX_DOTS; i++) {
        const p = path[(i + 1) * DOT_EVERY]
        if (p) mesh.setMatrixAt(i, scratch.m.makeTranslation(p.x, p.y, p.z))
        else mesh.setMatrixAt(i, scratch.hidden)
      }
      mesh.instanceMatrix.needsUpdate = true
    }
    const end = path[path.length - 1]
    if (marker.current) {
      marker.current.visible = end !== undefined
      if (end) marker.current.position.set(end.x, 0.02, end.z)
    }
    const s = slide.splash
    const age = s ? game.engine.time - s.at : Infinity
    if (splash.current && splashMaterial.current) {
      const on = s !== null && age >= 0 && age < SPLASH_S
      splash.current.visible = on
      if (on && s) {
        // Without motion, a still ring marks the spot for as long.
        const k = reduced ? 0.6 : age / SPLASH_S
        splash.current.position.set(s.x, 0.03, s.z)
        splash.current.scale.setScalar(0.3 + k * SPLASH_RADIUS)
        splashMaterial.current.opacity = reduced ? 0.6 : 0.8 * (1 - k)
      }
    }
  })

  const { pivot } = c
  return (
    <>
      {/* The platform at the top, hung from above the cabinet. */}
      <group position={[pivot.x, pivot.y, pivot.z]}>
        <mesh position={[0, -0.3, -0.2]}>
          <boxGeometry args={[1.5, 0.16, 0.7]} />
          <meshStandardMaterial color={PALETTE.slide} />
        </mesh>
        {[-0.65, 0.65].map(x => (
          <mesh key={x} position={[x, 1.4, -0.2]}>
            <boxGeometry args={[0.07, 2.9, 0.07]} />
            <meshStandardMaterial color={PALETTE.slideRail} />
          </mesh>
        ))}
        <group ref={turn}>
          <mesh geometry={trough}>
            <meshStandardMaterial color={PALETTE.slide} side={THREE.DoubleSide} roughness={0.4} />
          </mesh>
          {/* A film of water down the middle, and spray off the lip. */}
          <mesh geometry={trough} position={[0, 0.015, 0]} scale={[0.5, 1, 1]}>
            <meshStandardMaterial
              color={PALETTE.splash}
              transparent
              opacity={0.45}
              side={THREE.DoubleSide}
            />
          </mesh>
          {[-0.3, 0, 0.3].map((x, i) => (
            <mesh key={x} position={[x, lip.y - pivot.y + 0.12 + i * 0.05, lip.forward + 0.25]}>
              <sphereGeometry args={[0.07, 8, 6]} />
              <meshStandardMaterial color={PALETTE.splash} transparent opacity={0.8} />
            </mesh>
          ))}
          {/* The next duck, waiting its turn at the top. */}
          <group ref={waiting} rotation={[0, -Math.PI / 2, 0]}>
            <mesh>
              <cylinderGeometry args={[0.4, 0.4, 0.42, 20]} />
              <meshStandardMaterial color={PALETTE.duck} />
            </mesh>
            <mesh position={[0.14, 0.36, 0]}>
              <sphereGeometry args={[0.24, 14, 10]} />
              <meshStandardMaterial color={PALETTE.duck} />
            </mesh>
            <mesh position={[0.42, 0.33, 0]}>
              <boxGeometry args={[0.2, 0.07, 0.15]} />
              <meshStandardMaterial color={PALETTE.duckBeak} />
            </mesh>
          </group>
        </group>
      </group>
      <instancedMesh ref={dots} args={[undefined, undefined, MAX_DOTS]} frustumCulled={false}>
        <sphereGeometry args={[0.06, 8, 6]} />
        <meshBasicMaterial color={PALETTE.cue} transparent opacity={0.85} />
      </instancedMesh>
      {/* Where a duck sent now hits the water: a ring with a dot in it, drawn over everything. */}
      <group ref={marker} renderOrder={10}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
          <ringGeometry args={[0.36, 0.46, 32]} />
          <meshBasicMaterial color={PALETTE.cue} transparent opacity={0.85} depthTest={false} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
          <circleGeometry args={[0.09, 16]} />
          <meshBasicMaterial color={PALETTE.cue} transparent opacity={0.85} depthTest={false} />
        </mesh>
      </group>
      <mesh ref={splash} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.8, 1, 32]} />
        <meshBasicMaterial ref={splashMaterial} color={PALETTE.splash} transparent />
      </mesh>
    </>
  )
}

/**
 * The slide's trough, in the frame of its top: a shallow channel with rails
 * either side, following the curve (forward is +z, heights from the top).
 */
function troughGeometry(
  points: readonly { forward: number; y: number }[],
  topY: number
): THREE.BufferGeometry {
  // Across the channel: rail top, rail foot, middle, rail foot, rail top.
  const across = [
    [-HALF_WIDTH, RAIL],
    [-HALF_WIDTH, 0],
    [0, -DIP],
    [HALF_WIDTH, 0],
    [HALF_WIDTH, RAIL],
  ]
  const positions: number[] = []
  for (const p of points) {
    // Under the duck's center by its half height, so it rides in the channel.
    for (const [x, up] of across) positions.push(x, p.y - topY - 0.21 + up, p.forward)
  }
  const index: number[] = []
  const n = across.length
  for (let i = 0; i < points.length - 1; i++) {
    for (let j = 0; j < n - 1; j++) {
      const a = i * n + j
      const b = a + n
      index.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setIndex(index)
  g.computeVertexNormals()
  return g
}
