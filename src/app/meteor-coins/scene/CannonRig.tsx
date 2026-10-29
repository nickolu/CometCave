'use client'

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

import type { Hoop } from '@/app/meteor-coins/lib/cannon'
import type { CannonDelivery } from '@/app/meteor-coins/lib/deliveries/cannon'
import type { DropGame } from '@/app/meteor-coins/lib/game'
import { PALETTE } from '@/app/meteor-coins/scene/palette'

/** Dots along the arc preview, one every this many physics steps of flight. */
const DOT_EVERY = 3
const MAX_DOTS = 60
const HOOP_TUBE = 0.07
/** Hoops hang from strings up to here. */
const STRING_TOP = 6.5

/**
 * Hoop-La Cannon's launcher: the brass cannon swinging at the front, the
 * coin in its mouth, a charge gauge beside it, the dotted arc a shot would
 * fly, and the three numbered hoops. Reads the game every frame; owns no
 * state of its own.
 */
export function CannonRig({ game, cannon: delivery }: { game: DropGame; cannon: CannonDelivery }) {
  const cannon = delivery.config
  const barrel = useRef<THREE.Group>(null)
  const loaded = useRef<THREE.Mesh>(null)
  const gauge = useRef<THREE.Mesh>(null)
  const dots = useRef<THREE.InstancedMesh>(null)
  const scratch = useMemo(
    () => ({ m: new THREE.Matrix4(), hidden: new THREE.Matrix4().makeScale(0, 0, 0) }),
    []
  )

  useFrame(() => {
    barrel.current?.rotation.set(cannon.elevation, -delivery.yaw, 0, 'YXZ')
    if (loaded.current) loaded.current.visible = game.canDrop
    const charge = delivery.charge
    if (gauge.current) {
      gauge.current.visible = charge !== null
      // Scaled about its middle, so moved up by half as much to fill from the bottom.
      const fill = Math.max(0.001, charge ?? 0)
      gauge.current.scale.set(1, fill, 1)
      gauge.current.position.y = 0.6 * fill
    }
    const mesh = dots.current
    if (!mesh) return
    const path = game.canDrop ? delivery.previewPath() : []
    for (let i = 0; i < MAX_DOTS; i++) {
      const p = path[(i + 1) * DOT_EVERY]
      if (p) mesh.setMatrixAt(i, scratch.m.makeTranslation(p.x, p.y, p.z))
      else mesh.setMatrixAt(i, scratch.hidden)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  const { pivot, barrel: length } = cannon
  return (
    <>
      {/* Carriage, with the barrel turning on top of it. */}
      <mesh position={[pivot.x, pivot.y / 2 - 0.1, pivot.z + 0.1]}>
        <boxGeometry args={[1.1, pivot.y - 0.2, 0.9]} />
        <meshStandardMaterial color={PALETTE.backWall} />
      </mesh>
      <group ref={barrel} position={[pivot.x, pivot.y, pivot.z]}>
        <mesh position={[0, 0, -length / 2 + 0.2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.38, 0.3, length + 0.4, 24]} />
          <meshStandardMaterial color={PALETTE.brass} metalness={0.7} roughness={0.35} />
        </mesh>
        <mesh ref={loaded} position={[0, 0.02, -length]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.28, 0.28, 0.06, 20]} />
          <meshStandardMaterial color={PALETTE.puck} metalness={0.3} roughness={0.55} />
        </mesh>
      </group>
      {/* Charge gauge: a frame beside the cannon that fills from the bottom. */}
      <group position={[pivot.x + 0.95, 0.15, pivot.z]}>
        <mesh position={[0, 0.6, 0]}>
          <boxGeometry args={[0.22, 1.24, 0.06]} />
          <meshBasicMaterial color={PALETTE.cue} transparent opacity={0.25} />
        </mesh>
        <mesh ref={gauge} position={[0, 0, 0.04]}>
          <boxGeometry args={[0.16, 1.2, 0.04]} />
          <meshBasicMaterial color={PALETTE.cue} />
        </mesh>
      </group>
      <instancedMesh ref={dots} args={[undefined, undefined, MAX_DOTS]} frustumCulled={false}>
        <sphereGeometry args={[0.06, 8, 6]} />
        <meshBasicMaterial color={PALETTE.cue} transparent opacity={0.8} />
      </instancedMesh>
      {cannon.hoops.map((hoop, i) => (
        <HoopMesh key={i} hoop={hoop} />
      ))}
    </>
  )
}

/** A hoop on a string, with its bonus written on a tag above it. */
function HoopMesh({ hoop }: { hoop: Hoop }) {
  const label = useMemo(() => labelTexture(`+${hoop.bonus}`), [hoop.bonus])
  const top = hoop.y + hoop.radius + HOOP_TUBE
  return (
    <group position={[hoop.x, 0, hoop.z]}>
      <mesh position={[0, hoop.y, 0]}>
        <torusGeometry args={[hoop.radius + HOOP_TUBE, HOOP_TUBE, 12, 48]} />
        <meshStandardMaterial
          color={PALETTE.hoop}
          emissive={PALETTE.hoop}
          emissiveIntensity={0.3}
        />
      </mesh>
      <mesh position={[0, (top + STRING_TOP) / 2, 0]}>
        <boxGeometry args={[0.02, STRING_TOP - top, 0.02]} />
        <meshBasicMaterial color={PALETTE.hoopLabel} transparent opacity={0.4} />
      </mesh>
      <sprite position={[0, top + 0.45, 0]} scale={[0.9, 0.6, 1]}>
        <spriteMaterial map={label} transparent />
      </sprite>
    </group>
  )
}

/** A bonus tag, drawn on a canvas: no font files to load. */
function labelTexture(text: string): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 192
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = PALETTE.hoop
    ctx.beginPath()
    ctx.roundRect(8, 8, 176, 112, 24)
    ctx.fill()
    ctx.fillStyle = PALETTE.hoopLabel
    ctx.font = 'bold 76px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 96, 68)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}
