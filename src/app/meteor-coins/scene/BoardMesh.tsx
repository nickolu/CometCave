'use client'

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

import { type Board, CUP_FLOOR, CUP_WALL, sweeperX } from '@/app/meteor-coins/lib/board'
import { FIELD_HALF_WIDTH } from '@/app/meteor-coins/lib/cabinet'
import type { PusherEngine } from '@/app/meteor-coins/lib/engine'
import { PALETTE } from '@/app/meteor-coins/scene/palette'

/** Points on each pin's star cap, and how far they reach. */
const STAR_POINTS = 5
const STAR_RADIUS = 0.2

/** The brass skirt along the board's bottom, hiding its gate (and coins being laid flat). */
const SKIRT_HEIGHT = 0.7

/**
 * Starfall Pachinko's board: two glass panes over the drop line, brass pins
 * across the slot with a small star on the front of each, bin dividers and
 * a skirt along the bottom, the cup, and the big star sweeping over it.
 */
export function BoardMesh({ board, engine }: { board: Board; engine: PusherEngine }) {
  const star = useMemo(() => starGeometry(STAR_POINTS, STAR_RADIUS, STAR_RADIUS * 0.45), [])
  const bigStar = useMemo(() => starGeometry(STAR_POINTS, 0.32, 0.14), [])
  const sweepers = useRef<(THREE.Group | null)[]>([])
  useFrame(() => {
    board.sweepers.forEach((s, i) => {
      sweepers.current[i]?.position.set(sweeperX(s, engine.time), s.y, board.z)
    })
  })
  const glassHeight = board.topY - board.bottomY
  const glassY = board.bottomY + glassHeight / 2
  const front = board.z + board.slot / 2
  const dividerHeight = board.dividerTop - board.bottomY
  return (
    <group>
      {[-1, 1].map(side => (
        <mesh key={side} position={[0, glassY, board.z + side * (board.slot / 2 + 0.05)]}>
          <boxGeometry args={[FIELD_HALF_WIDTH * 2, glassHeight, 0.1]} />
          <meshStandardMaterial
            color={PALETTE.glassWall}
            transparent
            opacity={side > 0 ? 0.08 : 0.18}
            depthWrite={false}
          />
        </mesh>
      ))}
      {[-1, 1].map(side => (
        <mesh key={side} position={[side * (FIELD_HALF_WIDTH + 0.05), glassY, board.z]}>
          <boxGeometry args={[0.1, glassHeight, board.slot + 0.2]} />
          <meshStandardMaterial color={PALETTE.brass} metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      {board.pins.map((pin, i) => (
        <group key={i} position={[pin.x, pin.y, board.z]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[board.pinRadius, board.pinRadius, board.slot, 10]} />
            <meshStandardMaterial color={PALETTE.brass} metalness={0.7} roughness={0.35} />
          </mesh>
          <mesh geometry={star} position={[0, 0, front - board.z + 0.11]}>
            <meshStandardMaterial
              color={PALETTE.chute}
              emissive={PALETTE.chute}
              emissiveIntensity={0.5}
            />
          </mesh>
        </group>
      ))}
      {board.sweepers.map((s, i) => (
        <group
          key={i}
          ref={group => {
            sweepers.current[i] = group
          }}
          position={[0, s.y, board.z]}
        >
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry
              args={[board.pinRadius * 1.5, board.pinRadius * 1.5, board.slot, 12]}
            />
            <meshStandardMaterial color={PALETTE.brass} metalness={0.7} roughness={0.35} />
          </mesh>
          <mesh geometry={bigStar} position={[0, 0, board.slot / 2 + 0.11]}>
            <meshStandardMaterial
              color={PALETTE.ringHit}
              emissive={PALETTE.ringHit}
              emissiveIntensity={0.6}
            />
          </mesh>
        </group>
      ))}
      <mesh position={[0, board.bottomY - SKIRT_HEIGHT / 2, front + 0.12]}>
        <boxGeometry args={[FIELD_HALF_WIDTH * 2 + 0.2, SKIRT_HEIGHT, 0.06]} />
        <meshStandardMaterial color={PALETTE.brass} metalness={0.6} roughness={0.4} />
      </mesh>
      {board.dividers.map(x => (
        <mesh key={x} position={[x, board.bottomY + dividerHeight / 2, board.z]}>
          <boxGeometry args={[0.08, dividerHeight, board.slot]} />
          <meshStandardMaterial color={PALETTE.brass} metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      {board.cups.map((cup, i) => (
        <group key={i} position={[cup.x, cup.y, board.z]}>
          <mesh position={[0, CUP_FLOOR / 2, 0]}>
            <boxGeometry args={[cup.width, CUP_FLOOR, board.slot + 0.2]} />
            <meshStandardMaterial color={PALETTE.ringHit} />
          </mesh>
          {[-1, 1].map(side => (
            <mesh key={side} position={[(side * cup.width) / 2, CUP_WALL / 2, 0]}>
              <boxGeometry args={[0.08, CUP_WALL, board.slot + 0.2]} />
              <meshStandardMaterial color={PALETTE.ringHit} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

/** A flat star facing the player, centered on its middle. */
function starGeometry(points: number, outer: number, inner: number): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  for (let i = 0; i <= points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2
    const r = i % 2 ? inner : outer
    if (i === 0) shape.moveTo(r * Math.cos(a), r * Math.sin(a))
    else shape.lineTo(r * Math.cos(a), r * Math.sin(a))
  }
  return new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false })
}
