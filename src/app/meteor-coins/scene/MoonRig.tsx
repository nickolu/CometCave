'use client'

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

import type { DropGame } from '@/app/meteor-coins/lib/game'
import type { MoonConfig } from '@/app/meteor-coins/lib/moon'
import { PALETTE } from '@/app/meteor-coins/scene/palette'

/** Dots along the drop preview, one every this many physics steps of fall. */
const DOT_EVERY = 3
const MAX_DOTS = 40
const MOON_RADIUS = 0.42
/** Meteorite countdowns that can show at once. */
const MAX_WARNINGS = 2
/** Countdown rings sit just above the shelf, drawn over the pile. */
const WARNING_Y = 0.65
const WARNING_RADIUS = 0.75

/**
 * Gravity Assist's sky: the moon on its orbit (drawn as a faint ellipse),
 * the dotted path a coin dropped now would fall, and a countdown ring on
 * the spot each announced meteorite will land. Reads the game every frame;
 * owns no state of its own.
 */
export function MoonRig({ game, moon }: { game: DropGame; moon: MoonConfig }) {
  const body = useRef<THREE.Group>(null)
  const dots = useRef<THREE.InstancedMesh>(null)
  const warnings = useRef<(THREE.Group | null)[]>([])
  const labels = useRef<(THREE.SpriteMaterial | null)[]>([])
  const digits = useMemo(() => [1, 2, 3].map(n => digitTexture(String(n))), [])
  const hidden = useMemo(() => new THREE.Matrix4().makeScale(0, 0, 0), [])
  const m = useMemo(() => new THREE.Matrix4(), [])
  const orbit = useMemo(() => {
    const points = Array.from({ length: 65 }, (_, i) => {
      const a = (i / 64) * Math.PI * 2
      return new THREE.Vector3(
        moon.center.x + moon.radiusX * Math.sin(a),
        moon.center.y,
        moon.center.z + moon.radiusZ * Math.cos(a)
      )
    })
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [moon])

  useFrame(() => {
    const at = game.moon
    if (at && body.current) {
      body.current.position.set(at.x, at.y, at.z)
      body.current.rotation.y = game.dropperTime * 0.4
    }
    const mesh = dots.current
    if (mesh) {
      const path = game.canDrop ? game.dropPath() : []
      for (let i = 0; i < MAX_DOTS; i++) {
        const p = path[(i + 1) * DOT_EVERY]
        mesh.setMatrixAt(i, p ? m.makeTranslation(p.x, p.y, p.z) : hidden)
      }
      mesh.instanceMatrix.needsUpdate = true
    }
    const due = game.meteorWarnings()
    for (let i = 0; i < MAX_WARNINGS; i++) {
      const group = warnings.current[i]
      const w = due[i]
      if (!group) continue
      group.visible = w !== undefined
      if (!w) continue
      group.position.set(w.x, WARNING_Y, w.z)
      // Closes in as it counts down: by size and number, not only color.
      const left = Math.max(0, w.secondsLeft)
      group.scale.setScalar(0.55 + 0.15 * left)
      const label = labels.current[i]
      const map = digits[Math.min(2, Math.max(0, Math.ceil(left) - 1))]
      if (label && label.map !== map) {
        label.map = map
        label.needsUpdate = true
      }
    }
  })

  return (
    <>
      <lineLoop geometry={orbit}>
        <lineBasicMaterial color={PALETTE.moonMark} transparent opacity={0.35} />
      </lineLoop>
      <group ref={body}>
        <mesh>
          <sphereGeometry args={[MOON_RADIUS, 24, 16]} />
          <meshStandardMaterial
            color={PALETTE.moon}
            emissive={PALETTE.moon}
            emissiveIntensity={0.35}
            roughness={0.9}
          />
        </mesh>
        {/* Craters, so it reads as a moon at any size. */}
        {(
          [
            [0.2, 0.15, 0.32, 0.1],
            [-0.25, -0.05, 0.3, 0.08],
            [0.05, -0.22, 0.34, 0.07],
          ] as const
        ).map(([x, y, z, r], i) => (
          <mesh key={i} position={[x, y, z]}>
            <sphereGeometry args={[r, 10, 8]} />
            <meshStandardMaterial color={PALETTE.moonMark} roughness={1} />
          </mesh>
        ))}
      </group>
      <instancedMesh ref={dots} args={[undefined, undefined, MAX_DOTS]} frustumCulled={false}>
        <sphereGeometry args={[0.055, 8, 6]} />
        <meshBasicMaterial color={PALETTE.cue} transparent opacity={0.8} />
      </instancedMesh>
      {Array.from({ length: MAX_WARNINGS }, (_, i) => (
        <group
          key={i}
          ref={group => {
            warnings.current[i] = group
          }}
          visible={false}
        >
          <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
            <ringGeometry args={[WARNING_RADIUS - 0.12, WARNING_RADIUS, 40]} />
            <meshBasicMaterial
              color={PALETTE.meteoriteMark}
              transparent
              opacity={0.9}
              depthTest={false}
            />
          </mesh>
          <sprite position={[0, 1.1, 0]} scale={[0.8, 0.8, 1]} renderOrder={11}>
            <spriteMaterial
              ref={material => {
                labels.current[i] = material
              }}
              map={digits[2]}
              transparent
              depthTest={false}
            />
          </sprite>
        </group>
      ))}
    </>
  )
}

/** A countdown digit on a dark disc, drawn on a canvas: no font files to load. */
function digitTexture(text: string): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = PALETTE.meteorite
    ctx.beginPath()
    ctx.arc(64, 64, 58, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = PALETTE.meteoriteMark
    ctx.font = 'bold 84px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 64, 70)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}
