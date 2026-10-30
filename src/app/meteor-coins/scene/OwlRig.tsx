'use client'

import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import { PUCK_RADIUS, PUCK_THICKNESS } from '@/app/meteor-coins/lib/cabinet'
import {
  FADE_S,
  HOO_S,
  MAX_PEAS,
  type OwlsDelivery,
  TALON_DROP,
} from '@/app/meteor-coins/lib/deliveries/owls'
import type { DropGame } from '@/app/meteor-coins/lib/game'
import { PALETTE } from '@/app/meteor-coins/scene/palette'

const MAX_DOTS = 48
const PEA_RADIUS = 0.13
/** Wing beats per second, and how far they swing. */
const FLAP_HZ = 2.2
const FLAP = 0.55
/** The aim mark on the page: a disc when a hit there now pays, an open ring when not. */
const MARK_RADIUS = 0.42
/** Drawn above the pile, whatever is under it. */
const MARK_Y = 0.25

/** Whether the player has asked for less motion. Read once per mount; it rarely changes mid-game. */
function useReducedMotion() {
  const reduced = useRef(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    reduced.current = query.matches
    const onChange = () => {
      reduced.current = query.matches
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/** The "hoo!" an owl says when a pea reaches it, drawn on a canvas: no font files to load. */
function hooTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = PALETTE.page
    ctx.beginPath()
    ctx.roundRect(12, 12, 232, 84, 40)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(100, 94)
    ctx.lineTo(118, 122)
    ctx.lineTo(136, 94)
    ctx.fill()
    ctx.fillStyle = PALETTE.ink
    ctx.font = 'italic bold 60px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('hoo!', 128, 56)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** One sleepy owl in a nightcap, facing the player, with a word in its talons. */
function OwlModel({
  groupRef,
  wingRefs,
  wordRef,
  hooRef,
  hoo,
}: {
  groupRef: (g: THREE.Group | null) => void
  wingRefs: (side: 0 | 1, g: THREE.Group | null) => void
  wordRef: (m: THREE.Group | null) => void
  hooRef: (s: THREE.Sprite | null) => void
  hoo: THREE.Texture
}) {
  return (
    <group ref={groupRef}>
      {/* Body and belly. */}
      <mesh scale={[0.42, 0.5, 0.38]}>
        <sphereGeometry args={[1, 20, 16]} />
        <meshStandardMaterial color={PALETTE.owl} roughness={0.9} />
      </mesh>
      <mesh position={[0, -0.1, 0.17]} scale={[0.3, 0.34, 0.22]}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshStandardMaterial color={PALETTE.owlBelly} roughness={0.9} />
      </mesh>
      {/* The face: a pale disc round each eye, eyes nearly shut, a little beak. */}
      {[-1, 1].map(side => (
        <group key={side} position={[side * 0.14, 0.17, 0.3]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.14, 0.14, 0.04, 18]} />
            <meshStandardMaterial color={PALETTE.owlFace} roughness={0.8} />
          </mesh>
          {/* A sleepy eye: a dark slit under a heavy lid. */}
          <mesh position={[0, -0.01, 0.025]} scale={[0.085, 0.025, 0.02]}>
            <sphereGeometry args={[1, 12, 8]} />
            <meshBasicMaterial color={PALETTE.owlEye} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.08, 0.36]} rotation={[Math.PI / 2 + 0.3, 0, 0]}>
        <coneGeometry args={[0.045, 0.12, 8]} />
        <meshStandardMaterial color={PALETTE.owlBeak} />
      </mesh>
      {/* Ear tufts. */}
      {[-1, 1].map(side => (
        <mesh
          key={side}
          position={[side * 0.24, 0.45, 0.05]}
          rotation={[0, 0, -side * 0.45]}
          scale={[1, 1, 0.6]}
        >
          <coneGeometry args={[0.07, 0.2, 8]} />
          <meshStandardMaterial color={PALETTE.owl} roughness={0.9} />
        </mesh>
      ))}
      {/* A nightcap, slumped to one side, with a pompom. */}
      <group position={[0.04, 0.42, 0]} rotation={[0, 0, -0.5]}>
        <mesh position={[0, 0.2, 0]}>
          <coneGeometry args={[0.24, 0.48, 16]} />
          <meshStandardMaterial color={PALETTE.nightcap} roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.46, 0]}>
          <sphereGeometry args={[0.08, 12, 10]} />
          <meshStandardMaterial color={PALETTE.pompom} roughness={0.9} />
        </mesh>
      </group>
      {/* Wings, hinged at the shoulder. */}
      {([0, 1] as const).map(side => (
        <group
          key={side}
          ref={g => wingRefs(side, g)}
          position={[side ? 0.36 : -0.36, 0.12, -0.02]}
        >
          <mesh position={[side ? 0.3 : -0.3, -0.05, 0]} scale={[0.38, 0.1, 0.26]}>
            <sphereGeometry args={[1, 14, 10]} />
            <meshStandardMaterial color={PALETTE.owl} roughness={0.9} />
          </mesh>
        </group>
      ))}
      {/* Feet, and the word held in them. */}
      {[-1, 1].map(side => (
        <mesh key={side} position={[side * 0.1, -0.47, 0.1]}>
          <sphereGeometry args={[0.05, 8, 6]} />
          <meshStandardMaterial color={PALETTE.owlBeak} />
        </mesh>
      ))}
      <group ref={wordRef} position={[0, -TALON_DROP, 0.05]} rotation={[0.5, 0, 0]}>
        <mesh>
          <cylinderGeometry args={[PUCK_RADIUS, PUCK_RADIUS, PUCK_THICKNESS, 24]} />
          <meshStandardMaterial color={PALETTE.word} roughness={0.7} />
        </mesh>
      </group>
      <sprite ref={hooRef} position={[0.55, 0.85, 0]} scale={[1.1, 0.55, 1]} renderOrder={12}>
        <spriteMaterial map={hoo} transparent depthTest={false} />
      </sprite>
    </group>
  )
}

/**
 * The Bedtime Book's owls and pea-shooter (lib/deliveries/owls): the owls
 * with their words, the shooter on its cotton reel at the near edge, the
 * peas in flight, the dotted arc of the next shot, and the aim mark on the
 * page. Reads the delivery every frame; owns no game state. Wing beats are
 * decoration and hold still under reduced motion; everything else moves
 * because the game does.
 */
export function OwlRig({ game, owls: delivery }: { game: DropGame; owls: OwlsDelivery }) {
  const config = delivery.config
  const reduced = useReducedMotion()
  const hoo = useMemo(() => hooTexture(), [])
  useEffect(() => () => hoo.dispose(), [hoo])
  const owlGroups = useRef<(THREE.Group | null)[]>([])
  const wings = useRef<(THREE.Group | null)[][]>([])
  const words = useRef<(THREE.Group | null)[]>([])
  const hoos = useRef<(THREE.Sprite | null)[]>([])
  const peas = useRef<(THREE.Mesh | null)[]>([])
  const pod = useRef<THREE.Group>(null)
  const dots = useRef<THREE.InstancedMesh>(null)
  const dotsMaterial = useRef<THREE.MeshBasicMaterial>(null)
  const mark = useRef<THREE.Group>(null)
  const markOpen = useRef<THREE.Mesh>(null)
  const markLit = useRef<THREE.Mesh>(null)
  const sight = useRef<THREE.Mesh>(null)
  const plumb = useRef<THREE.Mesh>(null)
  const scratch = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      hidden: new THREE.Matrix4().makeScale(0, 0, 0),
      dir: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
      q: new THREE.Quaternion(),
    }),
    []
  )

  useFrame(() => {
    const now = game.dropperTime
    const flap = reduced.current ? 0.25 : Math.sin(now * Math.PI * 2 * FLAP_HZ) * FLAP
    delivery.owls.forEach((owl, i) => {
      const g = owlGroups.current[i]
      if (!g) return
      g.visible = owl.backAt === null
      if (!g.visible) return
      g.position.set(owl.x, owl.y, owl.z)
      // Facing the player, turned a little toward where it's flying.
      g.rotation.set(0, Math.sign(owl.vx) * 0.45, 0)
      const [left, right] = wings.current[i] ?? []
      left?.rotation.set(0, 0, flap)
      right?.rotation.set(0, 0, -flap)
      const word = words.current[i]
      if (word) word.visible = owl.carrying
      const bubble = hoos.current[i]
      if (bubble) bubble.visible = owl.hooAt !== null && now - owl.hooAt < HOO_S * game.speed
    })

    for (let i = 0; i < MAX_PEAS; i++) {
      const mesh = peas.current[i]
      if (!mesh) continue
      const pea = delivery.peas[i]
      mesh.visible = pea !== undefined
      if (!pea) continue
      mesh.position.set(pea.at.x, pea.at.y, pea.at.z)
      // A miss fades (and shrinks) out past its aim point.
      const fade = Math.max(0, Math.min(1, 1 - (pea.age - pea.reach) / FADE_S))
      mesh.scale.setScalar(0.4 + 0.6 * fade)
      ;(mesh.material as THREE.MeshStandardMaterial).opacity = fade
    }

    // The pod points along the shot it would fire.
    const { velocity } = delivery.shot()
    scratch.dir.set(velocity.x, velocity.y, velocity.z).normalize()
    pod.current?.quaternion.copy(scratch.q.setFromUnitVectors(scratch.up, scratch.dir))

    const ready = delivery.ready
    const path = game.canDrop ? delivery.previewPath() : []
    const mesh = dots.current
    if (mesh) {
      for (let i = 0; i < MAX_DOTS; i++) {
        const p = path[i + 2]
        if (p) mesh.setMatrixAt(i, scratch.m.makeTranslation(p.x, p.y, p.z))
        else mesh.setMatrixAt(i, scratch.hidden)
      }
      mesh.instanceMatrix.needsUpdate = true
    }
    // Faint while reloading, so a dud tap is expected.
    if (dotsMaterial.current) dotsMaterial.current.opacity = ready ? 0.9 : 0.35
    const aim = delivery.aim
    sight.current?.position.set(aim.x, aim.y, aim.z)
    if (sight.current) sight.current.visible = game.canDrop
    plumb.current?.position.set(aim.x, (aim.y + MARK_Y) / 2, aim.z)
    if (plumb.current) plumb.current.visible = game.canDrop
    if (mark.current) {
      mark.current.position.set(aim.x, MARK_Y, aim.z)
      mark.current.visible = game.canDrop
      const lit = delivery.aimLit
      if (markLit.current) markLit.current.visible = lit
      if (markOpen.current) markOpen.current.visible = !lit
    }
  })

  const { shooter } = config
  return (
    <>
      {delivery.owls.map((_, i) => (
        <OwlModel
          key={i}
          hoo={hoo}
          groupRef={g => {
            owlGroups.current[i] = g
          }}
          wingRefs={(side, g) => {
            wings.current[i] ??= []
            wings.current[i][side] = g
          }}
          wordRef={g => {
            words.current[i] = g
          }}
          hooRef={s => {
            hoos.current[i] = s
          }}
        />
      ))}

      {Array.from({ length: MAX_PEAS }, (_, i) => (
        <mesh
          key={i}
          ref={m => {
            peas.current[i] = m
          }}
          visible={false}
        >
          <sphereGeometry args={[PEA_RADIUS, 14, 10]} />
          <meshStandardMaterial color={PALETTE.pea} roughness={0.6} transparent />
        </mesh>
      ))}

      {/* The shooter: a pea pod on a cotton reel, standing on the near edge of the book. */}
      <group position={[shooter.x, 0, shooter.z]}>
        <mesh position={[0, (shooter.y - 0.25 - 1) / 2, 0]}>
          <cylinderGeometry args={[0.3, 0.3, shooter.y - 0.25 + 1, 20]} />
          <meshStandardMaterial color={PALETTE.ribbon} roughness={0.8} />
        </mesh>
        {[-1, shooter.y - 0.28].map(y => (
          <mesh key={y} position={[0, y, 0]}>
            <cylinderGeometry args={[0.42, 0.42, 0.08, 24]} />
            <meshStandardMaterial color={PALETTE.reel} roughness={0.7} />
          </mesh>
        ))}
        <group ref={pod} position={[0, shooter.y - 0.05, 0]}>
          <mesh position={[0, 0.25, 0]}>
            <capsuleGeometry args={[0.13, 0.6, 6, 14]} />
            <meshStandardMaterial color={PALETTE.pod} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.62, 0]}>
            <sphereGeometry args={[0.1, 12, 10]} />
            <meshStandardMaterial color={PALETTE.pea} roughness={0.6} />
          </mesh>
          <mesh position={[0.14, 0.05, 0]} rotation={[0, 0, -0.6]} scale={[0.09, 0.24, 0.03]}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshStandardMaterial color={PALETTE.pod} roughness={0.7} />
          </mesh>
        </group>
      </group>

      {/* The next shot's arc, and a sight ring where it passes the owls' height. */}
      <instancedMesh ref={dots} args={[undefined, undefined, MAX_DOTS]} frustumCulled={false}>
        <sphereGeometry args={[0.055, 8, 6]} />
        <meshBasicMaterial ref={dotsMaterial} color={PALETTE.aim} transparent opacity={0.9} />
      </instancedMesh>
      <mesh ref={sight} rotation={[-Math.PI / 2, 0, 0]} renderOrder={11}>
        <ringGeometry args={[0.32, 0.4, 28]} />
        <meshBasicMaterial
          color={PALETTE.aim}
          transparent
          opacity={0.85}
          depthTest={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* A faint line straight down from the sight to the page, joining it to the mark below. */}
      <mesh ref={plumb}>
        <cylinderGeometry args={[0.015, 0.015, config.aimY - MARK_Y, 6]} />
        <meshBasicMaterial color={PALETTE.aim} transparent opacity={0.3} />
      </mesh>
      {/* Where a word knocked loose there would fall: solid when it'd land in front of a pulled-back page. */}
      <group ref={mark} renderOrder={10}>
        <mesh ref={markLit} rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
          <circleGeometry args={[MARK_RADIUS, 28]} />
          <meshBasicMaterial color={PALETTE.cue} transparent opacity={0.7} depthTest={false} />
        </mesh>
        <mesh ref={markOpen} rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
          <ringGeometry args={[MARK_RADIUS - 0.07, MARK_RADIUS, 28]} />
          <meshBasicMaterial color={PALETTE.cue} transparent opacity={0.45} depthTest={false} />
        </mesh>
      </group>
    </>
  )
}
