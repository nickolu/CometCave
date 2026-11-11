'use client'

import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

import { PUCK_RADIUS, PUCK_THICKNESS } from '@/app/meteor-coins/lib/cabinet'
import {
  SPIDER_RAIL_ABOVE,
  type SpiderDelivery,
  spiderCueLit,
} from '@/app/meteor-coins/lib/deliveries/spider'
import type { DropGame } from '@/app/meteor-coins/lib/game'
import { PALETTE } from '@/app/meteor-coins/scene/palette'

/** The spider's body sits this far above the coin it holds. */
const BODY_ABOVE = 0.55
const BODY_RADIUS = 0.42
/** Four legs a side: their angle around the body, front to back. */
const LEG_ANGLES = [-0.9, -0.3, 0.3, 0.9]

/**
 * The Cairn's spider: a wooden rail across the posts, a silver thread down
 * from it, and a round, big-eyed spider at the end holding the next coin in
 * its legs. Under it, where the coin would land: a dot, solid when a drop
 * now would land square and soft on a post, an open ring when not, with a
 * faint guide line down to it. Reads the game every frame; owns no state.
 */
export function SpiderRig({ game, spider }: { game: DropGame; spider: SpiderDelivery }) {
  const c = spider.config
  const railY = c.highY + SPIDER_RAIL_ABOVE
  const body = useRef<THREE.Group>(null)
  const legs = useRef<THREE.Group>(null)
  const coin = useRef<THREE.Mesh>(null)
  const thread = useRef<THREE.Mesh>(null)
  const dot = useRef<THREE.Group>(null)
  const dotOn = useRef<THREE.Mesh>(null)
  const dotOff = useRef<THREE.Mesh>(null)
  const guide = useRef<THREE.Mesh>(null)
  // The leg wiggle is decoration only, so it stops for reduced motion.
  const still = useRef(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => (still.current = query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useFrame(() => {
    const tip = spider.tipAt()
    const holding = spider.holding
    const bodyY = tip.y + BODY_ABOVE
    body.current?.position.set(tip.x, bodyY, tip.z)
    if (legs.current) {
      legs.current.rotation.y = still.current ? 0 : 0.08 * Math.sin(game.dropperTime * 7)
    }
    // Scaled about its middle, the thread runs from the rail to the body.
    if (thread.current) {
      const length = railY - bodyY
      thread.current.scale.set(1, length, 1)
      thread.current.position.set(tip.x, bodyY + length / 2, tip.z)
    }
    // While it fetches the next coin, the coin grows back into its legs.
    if (coin.current) {
      const grown = holding ? 1 : Math.max(0.01, spider.reload)
      coin.current.visible = game.canDrop
      coin.current.scale.setScalar(grown)
    }
    const landing = game.landing(0, tip)
    const lit = holding && spiderCueLit(landing, tip)
    if (dot.current) {
      dot.current.visible = holding
      dot.current.position.set(landing.x, landing.y + 0.02, landing.z)
    }
    if (dotOn.current) dotOn.current.visible = lit
    if (dotOff.current) dotOff.current.visible = !lit
    if (guide.current) {
      guide.current.visible = holding
      const length = Math.max(0.01, tip.y - PUCK_THICKNESS - landing.y)
      guide.current.scale.set(1, length, 1)
      guide.current.position.set(tip.x, landing.y + length / 2, tip.z)
    }
  })

  return (
    <>
      {/* The rail, on a stone pillar at each end. */}
      <mesh position={[0, railY, c.z]}>
        <boxGeometry args={[(c.halfWidth + 0.8) * 2, 0.16, 0.22]} />
        <meshStandardMaterial color={PALETTE.rail} roughness={0.8} />
      </mesh>
      {[-1, 1].map(side => (
        <mesh key={side} position={[side * (c.halfWidth + 0.7), railY / 2, c.z]}>
          <boxGeometry args={[0.24, railY, 0.24]} />
          <meshStandardMaterial color={PALETTE.stone} roughness={0.9} />
        </mesh>
      ))}
      <mesh ref={thread}>
        <boxGeometry args={[0.025, 1, 0.025]} />
        <meshBasicMaterial color={PALETTE.thread} transparent opacity={0.8} />
      </mesh>

      <group ref={body}>
        {/* Body and a paler belly, facing the player (+z). */}
        <mesh>
          <sphereGeometry args={[BODY_RADIUS, 24, 18]} />
          <meshStandardMaterial color={PALETTE.spider} roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.08, 0.2]} scale={[0.75, 0.7, 0.6]}>
          <sphereGeometry args={[BODY_RADIUS, 20, 14]} />
          <meshStandardMaterial color={PALETTE.spiderBelly} roughness={0.7} />
        </mesh>
        {/* Two big eyes, with pupils looking down at the posts. */}
        {[-1, 1].map(side => (
          <group key={side} position={[side * 0.16, 0.12, BODY_RADIUS - 0.06]}>
            <mesh>
              <sphereGeometry args={[0.13, 16, 12]} />
              <meshStandardMaterial color={PALETTE.spiderEye} roughness={0.3} />
            </mesh>
            <mesh position={[0, -0.04, 0.1]}>
              <sphereGeometry args={[0.06, 12, 10]} />
              <meshBasicMaterial color={PALETTE.spiderPupil} />
            </mesh>
          </group>
        ))}
        {/* Eight legs, bent at the knee, reaching down around the coin. */}
        <group ref={legs}>
          {[-1, 1].flatMap(side =>
            LEG_ANGLES.map(a => (
              <group key={`${side}${a}`} rotation={[0, a * side, 0]}>
                <mesh position={[side * 0.5, 0.08, 0]} rotation={[0, 0, side * -0.5]}>
                  <cylinderGeometry args={[0.035, 0.035, 0.42, 6]} />
                  <meshStandardMaterial color={PALETTE.spider} />
                </mesh>
                <mesh position={[side * 0.68, -0.25, 0]} rotation={[0, 0, side * 0.35]}>
                  <cylinderGeometry args={[0.03, 0.02, 0.5, 6]} />
                  <meshStandardMaterial color={PALETTE.spider} />
                </mesh>
              </group>
            ))
          )}
        </group>
        <mesh ref={coin} position={[0, -BODY_ABOVE, 0]}>
          <cylinderGeometry args={[PUCK_RADIUS, PUCK_RADIUS, PUCK_THICKNESS, 24]} />
          <meshStandardMaterial color={PALETTE.puck} metalness={0.3} roughness={0.55} />
        </mesh>
      </group>

      {/* Where the coin would land: solid when square and soft, an open ring when not. */}
      <group ref={dot} renderOrder={10}>
        <mesh ref={dotOn} rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
          <circleGeometry args={[PUCK_RADIUS, 32]} />
          <meshBasicMaterial color={PALETTE.cue} transparent opacity={0.75} depthTest={false} />
        </mesh>
        <mesh ref={dotOff} rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
          <ringGeometry args={[PUCK_RADIUS - 0.08, PUCK_RADIUS, 32]} />
          <meshBasicMaterial color={PALETTE.cue} transparent opacity={0.45} depthTest={false} />
        </mesh>
      </group>
      <mesh ref={guide}>
        <boxGeometry args={[0.03, 1, 0.03]} />
        <meshBasicMaterial color={PALETTE.cue} transparent opacity={0.25} />
      </mesh>
    </>
  )
}
