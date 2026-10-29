'use client'

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

import { FIELD_HALF_WIDTH } from '@/app/meteor-coins/lib/cabinet'
import type { CraneDelivery } from '@/app/meteor-coins/lib/deliveries/crane'
import type { DropGame } from '@/app/meteor-coins/lib/game'
import { PALETTE } from '@/app/meteor-coins/scene/palette'

/** The rails run just outside the glass side walls, so they frame the table and hide none of it. */
const RAIL_X = FIELD_HALF_WIDTH + 0.45
/** The claw's three fingers: how far they splay when closed on a coin, and when open. */
const FINGER_CLOSED = 0.35
const FINGER_OPEN = 0.95
/** Dots down the drop line from the claw to the marker. */
const DROP_DOTS = 8
/** A claw this still drops where its marker says. */
const STEADY = 0.1

/**
 * Moonstone Porch's crane: a gantry on two rails along the side walls, a
 * bridge across that slides in depth, a trolley on it that slides across,
 * and the claw hanging on its cable with the next coin. Under it, a marker
 * on the pile where a coin let go now would land, and a dotted line down
 * to it, so depth reads as well as side to side. The marker is a solid
 * disc when the claw holds a coin and is steady, an open ring while it
 * swings or reloads. Reads the game every frame; owns no state.
 */
export function CraneRig({ game, crane }: { game: DropGame; crane: CraneDelivery }) {
  const c = crane.config
  const gantryY = c.y + c.cable
  const bridge = useRef<THREE.Group>(null)
  const trolley = useRef<THREE.Mesh>(null)
  const cable = useRef<THREE.Mesh>(null)
  const claw = useRef<THREE.Group>(null)
  const fingers = useRef<(THREE.Group | null)[]>([])
  const held = useRef<THREE.Mesh>(null)
  const marker = useRef<THREE.Group>(null)
  const markerSolid = useRef<THREE.Mesh>(null)
  const markerRing = useRef<THREE.Mesh>(null)
  const dots = useRef<THREE.InstancedMesh>(null)
  const scratch = useMemo(
    () => ({
      up: new THREE.Vector3(0, 1, 0),
      dir: new THREE.Vector3(),
      m: new THREE.Matrix4(),
      hidden: new THREE.Matrix4().makeScale(0, 0, 0),
    }),
    []
  )

  useFrame(() => {
    const s = scratch
    const t = crane.trolley
    const at = crane.claw
    bridge.current?.position.set(0, gantryY, t.z)
    trolley.current?.position.set(t.x, 0, 0)
    // The cable runs from the trolley to the top of the claw, leaning with the swing.
    if (cable.current) {
      s.dir.set(t.x - at.x, gantryY - (at.y + 0.35), t.z - at.z)
      const length = s.dir.length()
      cable.current.position.set((t.x + at.x) / 2, (gantryY + at.y + 0.35) / 2, (t.z + at.z) / 2)
      cable.current.quaternion.setFromUnitVectors(s.up, s.dir.normalize())
      cable.current.scale.set(1, length, 1)
    }
    claw.current?.position.set(at.x, at.y, at.z)
    const loaded = crane.loaded && game.canDrop
    // The fingers open as the coin goes, and close again as the next is picked up.
    const open = loaded ? 0 : Math.max(0, 1 - crane.reload * 1.2)
    const splay = FINGER_CLOSED + (FINGER_OPEN - FINGER_CLOSED) * open
    fingers.current.forEach(f => f?.rotation.set(0, 0, splay))
    if (held.current) held.current.visible = loaded

    const path = crane.fallPath()
    const land = path[path.length - 1]
    if (marker.current) {
      marker.current.visible = game.canDrop
      marker.current.position.set(land.x, land.y, land.z)
    }
    const steady = loaded && crane.swing < STEADY
    if (markerSolid.current) markerSolid.current.visible = steady
    if (markerRing.current) markerRing.current.visible = !steady
    const mesh = dots.current
    if (mesh) {
      for (let i = 0; i < DROP_DOTS; i++) {
        const p = path[Math.floor(((i + 1) * (path.length - 1)) / (DROP_DOTS + 1))]
        if (p && game.canDrop) mesh.setMatrixAt(i, s.m.makeTranslation(p.x, p.y, p.z))
        else mesh.setMatrixAt(i, s.hidden)
      }
      mesh.instanceMatrix.needsUpdate = true
    }
  })

  const [z0, z1] = c.z
  const railFrom = z0 - 0.7
  const railTo = z1 + 0.7
  const railLength = railTo - railFrom
  return (
    <>
      {/* Rails along both sides, on four slim posts. */}
      {[-1, 1].map(side => (
        <group key={side}>
          <mesh position={[side * RAIL_X, gantryY + 0.1, (railFrom + railTo) / 2]}>
            <boxGeometry args={[0.16, 0.16, railLength]} />
            <meshStandardMaterial color={PALETTE.craneRail} metalness={0.5} roughness={0.4} />
          </mesh>
          {[railFrom + 0.1, railTo - 0.1].map(z => (
            <mesh key={z} position={[side * RAIL_X, (gantryY + 0.1) / 2, z]}>
              <boxGeometry args={[0.1, gantryY + 0.1, 0.1]} />
              <meshStandardMaterial color={PALETTE.craneRail} metalness={0.5} roughness={0.4} />
            </mesh>
          ))}
        </group>
      ))}
      {/* The bridge across, with the trolley riding on it. */}
      <group ref={bridge}>
        <mesh position={[0, 0.1, 0]}>
          <boxGeometry args={[RAIL_X * 2 + 0.2, 0.12, 0.22]} />
          <meshStandardMaterial color={PALETTE.crane} metalness={0.3} roughness={0.5} />
        </mesh>
        <mesh ref={trolley}>
          <boxGeometry args={[0.5, 0.26, 0.42]} />
          <meshStandardMaterial color={PALETTE.crane} metalness={0.3} roughness={0.5} />
        </mesh>
      </group>
      <mesh ref={cable}>
        <cylinderGeometry args={[0.025, 0.025, 1, 6]} />
        <meshStandardMaterial color={PALETTE.craneRail} />
      </mesh>
      <group ref={claw}>
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.16, 0.22, 0.16, 16]} />
          <meshStandardMaterial color={PALETTE.crane} metalness={0.4} roughness={0.4} />
        </mesh>
        {[0, 1, 2].map(i => (
          <group key={i} rotation={[0, (i * 2 * Math.PI) / 3, 0]} position={[0, 0.25, 0]}>
            <group
              ref={g => {
                fingers.current[i] = g
              }}
            >
              <mesh position={[0, -0.25, 0]}>
                <boxGeometry args={[0.06, 0.5, 0.06]} />
                <meshStandardMaterial color={PALETTE.arm} metalness={0.5} roughness={0.4} />
              </mesh>
            </group>
          </group>
        ))}
        <mesh ref={held} position={[0, -0.05, 0]}>
          <cylinderGeometry args={[0.5, 0.5, 0.18, 28]} />
          <meshStandardMaterial color={PALETTE.puck} metalness={0.3} roughness={0.55} />
        </mesh>
      </group>
      {/* Where it would land: drawn over everything, so it never hides under coins. */}
      <group ref={marker} renderOrder={10}>
        <mesh ref={markerSolid} rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
          <circleGeometry args={[0.5, 32]} />
          <meshBasicMaterial color={PALETTE.cue} transparent opacity={0.7} depthTest={false} />
        </mesh>
        <mesh ref={markerRing} rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
          <ringGeometry args={[0.42, 0.5, 32]} />
          <meshBasicMaterial color={PALETTE.cue} transparent opacity={0.5} depthTest={false} />
        </mesh>
      </group>
      <instancedMesh ref={dots} args={[undefined, undefined, DROP_DOTS]} frustumCulled={false}>
        <sphereGeometry args={[0.05, 8, 6]} />
        <meshBasicMaterial color={PALETTE.cue} transparent opacity={0.7} />
      </instancedMesh>
    </>
  )
}
