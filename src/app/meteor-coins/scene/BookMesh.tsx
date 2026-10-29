'use client'

import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import {
  BACK_WALL_GAP,
  type Deck,
  FIELD_HALF_WIDTH,
  PUSHER_HEIGHT,
  WALL_HEIGHT,
  deckDir,
  fieldBackZ,
  fieldFrontZ,
} from '@/app/meteor-coins/lib/cabinet'
import type { DropGame } from '@/app/meteor-coins/lib/game'
import { PALETTE } from '@/app/meteor-coins/scene/palette'

/**
 * The Bedtime Book's table, dressed as an open picture book (the physics
 * is the plain two-deck table; this only draws it). Each page is a thick
 * block of paper on a cloth-covered board, curling down into the spine;
 * the pushers are stacks of loose leaves; the wall at the far end is a
 * pop-up night scene; a ribbon bookmark trails out of the near end. All
 * of it sits under a deep blue night sky with a warm lamp to one side.
 *
 * Nothing here moves on its own: the only motion is the leaves, which
 * follow the pushers. So there's nothing to hold still for reduced motion.
 */

/** Paper under the page surface, down to the board. */
const PAGE_BOTTOM_Y = -1
const BOARD_THICKNESS = 0.28
/** How far the boards reach past the paper. */
const BOARD_LIP = 0.4
/** Where a page's top surface sits, by distance out from its edge at the spine: a gentle dip, then a curl down into the gutter. */
const CURL: readonly [number, number][] = [
  [-0.09, -0.95],
  [-0.09, -0.55],
  [-0.075, -0.32],
  [-0.045, -0.17],
  [-0.01, -0.085],
  [0.08, -0.055],
  [0.2, -0.032],
  [0.35, -0.016],
  [0.55, -0.005],
  [0.8, 0],
]
/** A canvas texture's pixels per table unit. */
const PX = 96

/** The page's surface profile out to `length`: [distance from the edge, height]. */
function profile(length: number): [number, number][] {
  return [...CURL, [length, 0]]
}

function canvasTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (ctx) draw(ctx)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

/** Fine lines of stacked page edges, repeating every 1/`perUnit` in v. */
function edgeTexture(perUnit: number, along: 'u' | 'v' = 'v'): THREE.CanvasTexture {
  const t = canvasTexture(along === 'v' ? 4 : 16, along === 'v' ? 16 : 4, ctx => {
    ctx.fillStyle = PALETTE.page
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = PALETTE.pageEdge
    if (along === 'v') ctx.fillRect(0, 0, 4, 5)
    else ctx.fillRect(0, 0, 5, 4)
  })
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.RepeatWrapping
  if (along === 'v') t.repeat.set(1, perUnit)
  else t.repeat.set(perUnit, 1)
  t.magFilter = THREE.LinearFilter
  return t
}

const STORY = {
  back: [
    'The moon came up over the hill,',
    'round and slow and silver-white.',
    '"Time for bed," the wind whispered,',
    'and one by one the stars came out',
    'to listen to the story.',
  ],
  front: [
    'Little Owl was not sleepy yet.',
    'She flew over the pages, carrying',
    'words for the story, one at a time.',
    'Every word that fell into the fold',
    'became part of the tale. The end.',
  ],
}

/** Lines of printed story text, a little illustration, and a page number. */
function drawPage(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  lines: readonly string[],
  /** Where the text block starts and the picture sits, in canvas pixels. */
  textTop: number,
  picture: (ctx: CanvasRenderingContext2D) => void,
  number: string,
  numberY: number
) {
  ctx.fillStyle = PALETTE.page
  ctx.fillRect(0, 0, w, h)
  // A warm wash, darker toward the gutter, like paper under a lamp.
  const wash = ctx.createLinearGradient(0, 0, w, 0)
  wash.addColorStop(0, 'rgba(255, 220, 160, 0.18)')
  wash.addColorStop(1, 'rgba(90, 60, 30, 0.08)')
  ctx.fillStyle = wash
  ctx.fillRect(0, 0, w, h)
  picture(ctx)
  ctx.fillStyle = PALETTE.ink
  ctx.font = `italic ${Math.round(PX * 0.34)}px Georgia, 'Times New Roman', serif`
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  lines.forEach((line, i) => ctx.fillText(line, PX * 0.7, textTop + i * PX * 0.5))
  ctx.fillStyle = PALETTE.inkSoft
  ctx.font = `${Math.round(PX * 0.26)}px Georgia, serif`
  ctx.textAlign = 'center'
  ctx.fillText(number, w / 2, numberY)
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2
    const rr = i % 2 ? r * 0.45 : r
    ctx.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a))
  }
  ctx.closePath()
  ctx.fill()
}

/** A crescent: a disc with a bite out of it (bitten on its own canvas, so the page under it stays). */
function crescent(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const size = Math.ceil(r * 2 + 4)
  const moon = document.createElement('canvas')
  moon.width = size
  moon.height = size
  const m = moon.getContext('2d')
  if (!m) return
  const c = size / 2
  m.fillStyle = color
  m.beginPath()
  m.arc(c, c, r, 0, Math.PI * 2)
  m.fill()
  m.globalCompositeOperation = 'destination-out'
  m.beginPath()
  m.arc(c + r * 0.45, c - r * 0.25, r * 0.85, 0, Math.PI * 2)
  m.fill()
  ctx.drawImage(moon, x - c, y - c)
}

/** A sleeping face: two closed-eye arcs and a small smile. */
function sleepyFace(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.strokeStyle = PALETTE.ink
  ctx.lineWidth = s * 0.07
  ctx.lineCap = 'round'
  for (const dx of [-0.28, 0.28]) {
    ctx.beginPath()
    ctx.arc(x + dx * s, y, s * 0.13, 0.15 * Math.PI, 0.85 * Math.PI)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(x, y + s * 0.22, s * 0.1, 0.2 * Math.PI, 0.8 * Math.PI)
  ctx.stroke()
}

/** A little bear asleep, curled under a blanket, for the near page. */
function sleepingBear(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = PALETTE.owl
  for (const dx of [-0.42, 0.42]) {
    ctx.beginPath()
    ctx.arc(x + dx * s, y - 0.42 * s, 0.18 * s, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.beginPath()
  ctx.arc(x, y, 0.55 * s, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = PALETTE.owlFace
  ctx.beginPath()
  ctx.ellipse(x, y + 0.12 * s, 0.4 * s, 0.32 * s, 0, 0, Math.PI * 2)
  ctx.fill()
  sleepyFace(ctx, x, y + 0.05 * s, s)
  // The blanket, with a scalloped hem.
  ctx.fillStyle = PALETTE.nightcap
  ctx.beginPath()
  ctx.moveTo(x - 1.3 * s, y + 0.45 * s)
  for (let i = 0; i <= 6; i++) {
    const bx = x - 1.3 * s + (i * 2.6 * s) / 6
    ctx.quadraticCurveTo(bx - 0.22 * s, y + 0.3 * s, bx, y + 0.45 * s)
  }
  ctx.lineTo(x + 1.3 * s, y + 1.1 * s)
  ctx.lineTo(x - 1.3 * s, y + 1.1 * s)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = PALETTE.ink
  ctx.font = `${Math.round(0.4 * s)}px Georgia, serif`
  ctx.fillText('z', x + 0.8 * s, y - 0.7 * s)
  ctx.font = `${Math.round(0.3 * s)}px Georgia, serif`
  ctx.fillText('z', x + 1.05 * s, y - 0.98 * s)
}

/**
 * One page's printed surface, mapped by table position: the canvas spans
 * x ±FIELD_HALF_WIDTH and z from `zFar` (top of the canvas) to `zNear`.
 */
function pageTexture(far: boolean, zFar: number, zNear: number): THREE.CanvasTexture {
  const w = Math.round(FIELD_HALF_WIDTH * 2 * PX)
  const h = Math.round((zNear - zFar) * PX)
  // Canvas y of a table z.
  const y = (z: number) => (z - zFar) * PX
  return canvasTexture(w, h, ctx => {
    if (far) {
      // The far page: its story by the spine (where the shelf shows), a moon and stars above.
      drawPage(
        ctx,
        w,
        h,
        STORY.back,
        y(-3.1),
        c => {
          c.fillStyle = PALETTE.dreamMark
          crescent(c, w * 0.8, y(-4.3), PX * 0.75, PALETTE.dreamMark)
          c.fillStyle = PALETTE.dreamMark
          ;[
            [0.12, -4.6, 0.16],
            [0.3, -4.2, 0.1],
            [0.55, -4.75, 0.13],
            [0.66, -3.9, 0.08],
            [0.93, -3.7, 0.1],
          ].forEach(([fx, z, r]) => star(c, w * fx, y(z), PX * r))
        },
        '14',
        y(-1.05)
      )
    } else {
      drawPage(
        ctx,
        w,
        h,
        STORY.front,
        y(1.6),
        c => sleepingBear(c, w * 0.82, y(4.3), PX * 0.62),
        '15',
        y(6.6)
      )
    }
  })
}

/**
 * A page's top surface as a strip following its profile, from the gutter
 * out to `length`, with UVs by table position (see pageTexture).
 */
function surfaceGeometry(
  edgeZ: number,
  dir: 1 | -1,
  length: number,
  zFar: number,
  zNear: number,
  lift: number
): THREE.BufferGeometry {
  const pts = profile(length)
  const positions: number[] = []
  const uvs: number[] = []
  const index: number[] = []
  pts.forEach(([s, y], i) => {
    const z = edgeZ + dir * s
    const v = 1 - (z - zFar) / (zNear - zFar)
    for (const side of [-1, 1]) {
      positions.push(side * FIELD_HALF_WIDTH, y + lift, z)
      uvs.push(side < 0 ? 0 : 1, v)
    }
    if (i > 0) {
      const a = (i - 1) * 2
      // Wound so the face points up whichever way the page runs.
      if (dir < 0) index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      else index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setIndex(index)
  g.computeVertexNormals()
  return g
}

/**
 * The block of paper under a page: its profile extruded across the book.
 * The two ends (the book's outer sides) show the stacked page edges.
 */
function blockGeometry(edgeZ: number, dir: 1 | -1, length: number): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  const pts = profile(length)
  // Shape coordinates: (z, y) in the table, extruded along +x.
  pts.forEach(([s, y], i) => {
    const z = edgeZ + dir * s
    if (i === 0) shape.moveTo(z, y)
    else shape.lineTo(z, y)
  })
  shape.lineTo(edgeZ + dir * length, PAGE_BOTTOM_Y)
  shape.lineTo(edgeZ + dir * CURL[0][0], PAGE_BOTTOM_Y)
  shape.closePath()
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: FIELD_HALF_WIDTH * 2,
    bevelEnabled: false,
    curveSegments: 1,
  })
  // Shape x → table z, shape y → y, extrusion → x.
  const m = new THREE.Matrix4().set(0, 0, 1, -FIELD_HALF_WIDTH, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1)
  g.applyMatrix4(m)
  if (m.determinant() < 0) {
    // The swap mirrors the mesh; flip the winding back.
    const idx = g.index
    if (idx) {
      for (let i = 0; i < idx.count; i += 3) {
        const b = idx.getX(i + 1)
        idx.setX(i + 1, idx.getX(i + 2))
        idx.setX(i + 2, b)
      }
    } else {
      const pos = g.getAttribute('position')
      const uv = g.getAttribute('uv')
      for (let i = 0; i < pos.count; i += 3) {
        for (const attr of [pos, uv]) {
          const size = attr.itemSize
          const arr = attr.array as Float32Array
          for (let k = 0; k < size; k++) {
            const t = arr[(i + 1) * size + k]
            arr[(i + 1) * size + k] = arr[(i + 2) * size + k]
            arr[(i + 2) * size + k] = t
          }
        }
      }
    }
  }
  g.computeVertexNormals()
  return g
}

/** The leaf on top of a pusher stack: a few lines of a story still to come. */
function leafTexture(): THREE.CanvasTexture {
  const w = Math.round(FIELD_HALF_WIDTH * 2 * PX)
  const h = 4 * PX
  return canvasTexture(w, h, ctx => {
    ctx.fillStyle = PALETTE.page
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(90, 60, 30, 0.1)'
    ctx.fillRect(0, 0, w, h)
    // Printed lines as soft grey bars of uneven length: text too far off to read.
    ctx.fillStyle = PALETTE.inkSoft
    for (let i = 0; i < 6; i++) {
      const y = PX * (0.6 + i * 0.55)
      const len = w * (i === 5 ? 0.45 : 0.86 - ((i * 37) % 11) / 100)
      for (let x = PX * 0.6; x < PX * 0.6 + len; ) {
        const word = PX * (0.25 + ((x * 7 + i * 13) % 50) / 100)
        ctx.fillRect(x, y, word, PX * 0.07)
        x += word + PX * 0.12
      }
    }
  })
}

/** The pop-up at the far end: a night scene cut out along hill and cloud tops. */
function popUpTexture(w: number, h: number): THREE.CanvasTexture {
  return canvasTexture(w, h, ctx => {
    // The card's outline: scalloped clouds over the top, everything inside it.
    const top = h * 0.08
    ctx.beginPath()
    ctx.moveTo(0, h)
    ctx.lineTo(0, top + h * 0.18)
    const bumps = 7
    for (let i = 0; i < bumps; i++) {
      const x0 = (i * w) / bumps
      const x1 = ((i + 1) * w) / bumps
      const lift = i % 2 ? h * 0.05 : h * 0.0
      ctx.bezierCurveTo(x0, top + lift - h * 0.06, x1, top + lift - h * 0.06, x1, top + h * 0.18)
    }
    ctx.lineTo(w, h)
    ctx.closePath()
    ctx.save()
    ctx.clip()
    const sky = ctx.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, PALETTE.nightDeep)
    sky.addColorStop(1, PALETTE.night)
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = PALETTE.star
    for (let i = 0; i < 40; i++) {
      const x = ((i * 977) % 1000) / 1000
      const y = ((i * 613) % 1000) / 1000
      star(ctx, x * w, top + h * 0.15 + y * h * 0.45, (i % 4 === 0 ? 0.018 : 0.009) * w)
    }
    // The moon, and a little bear asleep in its curve.
    const mx = w * 0.27
    const my = h * 0.42
    const mr = h * 0.2
    crescent(ctx, mx, my, mr, PALETTE.moon)
    ctx.save()
    ctx.translate(mx - mr * 0.15, my + mr * 0.25)
    ctx.scale(0.55, 0.55)
    sleepingBear(ctx, 0, 0, mr * 0.55)
    ctx.restore()
    // Two rows of hills, and a house with its window lit.
    ctx.fillStyle = PALETTE.hillFar
    ctx.beginPath()
    ctx.moveTo(0, h)
    ctx.lineTo(0, h * 0.7)
    ctx.quadraticCurveTo(w * 0.25, h * 0.55, w * 0.5, h * 0.68)
    ctx.quadraticCurveTo(w * 0.75, h * 0.8, w, h * 0.62)
    ctx.lineTo(w, h)
    ctx.fill()
    const hx = w * 0.72
    const hy = h * 0.66
    const hs = h * 0.12
    ctx.fillStyle = PALETTE.hill
    ctx.fillRect(hx - hs * 0.6, hy - hs * 0.6, hs * 1.2, hs * 0.9)
    ctx.beginPath()
    ctx.moveTo(hx - hs * 0.8, hy - hs * 0.55)
    ctx.lineTo(hx, hy - hs * 1.3)
    ctx.lineTo(hx + hs * 0.8, hy - hs * 0.55)
    ctx.fill()
    ctx.fillStyle = PALETTE.window
    ctx.fillRect(hx - hs * 0.2, hy - hs * 0.35, hs * 0.4, hs * 0.35)
    ctx.fillStyle = PALETTE.hill
    ctx.beginPath()
    ctx.moveTo(0, h)
    ctx.lineTo(0, h * 0.82)
    ctx.quadraticCurveTo(w * 0.35, h * 0.68, w * 0.62, h * 0.84)
    ctx.quadraticCurveTo(w * 0.85, h * 0.95, w, h * 0.8)
    ctx.lineTo(w, h)
    ctx.fill()
    ctx.restore()
    // A paper rim round the cut edge.
    ctx.strokeStyle = PALETTE.page
    ctx.lineWidth = w * 0.006
    ctx.stroke()
  })
}

/** The ribbon's path: out of the near end of the book, over the page edges, onto the board. */
function ribbonGeometry(x: number, nearZ: number): THREE.BufferGeometry {
  const half = 0.13
  const boardTop = PAGE_BOTTOM_Y
  const path: [number, number][] = [
    [nearZ - 0.3, -0.04],
    [nearZ + 0.02, -0.08],
    [nearZ + 0.07, -0.3],
    [nearZ + 0.1, -0.7],
    [nearZ + 0.2, boardTop + 0.01],
    [nearZ + 0.5, boardTop + 0.015],
    [nearZ + 0.85, boardTop + 0.01],
  ]
  const positions: number[] = []
  const index: number[] = []
  path.forEach(([z, y], i) => {
    positions.push(x - half, y, z, x + half, y, z)
    if (i > 0) {
      const a = (i - 1) * 2
      index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  })
  // The notched tail.
  const [lz, ly] = path[path.length - 1]
  const tip = positions.length / 3
  positions.push(x - half, ly, lz + 0.3, x, ly, lz + 0.14, x + half, ly, lz + 0.3)
  const end = tip - 2
  index.push(end, tip, tip + 1, end, tip + 1, end + 1, end + 1, tip + 1, tip + 2)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setIndex(index)
  g.computeVertexNormals()
  return g
}

/** Stars scattered over the sky dome's upper half. Fixed: no twinkling. */
function skyStars(radius: number, count: number): THREE.BufferGeometry {
  const positions: number[] = []
  for (let i = 0; i < count; i++) {
    const a = (i * 2.399963) % (Math.PI * 2)
    const h = 0.08 + ((i * 0.618034) % 1) * 0.85
    const r = Math.sqrt(1 - h * h) * radius
    positions.push(r * Math.cos(a), h * radius, r * Math.sin(a))
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  return g
}

export function BookMesh({ game }: { game: DropGame }) {
  const layout = game.engine.layout
  const leaves = useRef<(THREE.Group | null)[]>([])
  const backZ = fieldBackZ(layout)
  const frontZ = fieldFrontZ(layout)

  const art = useMemo(() => {
    const pages = layout.map(deck => {
      const dir = (deckDir(deck) === 1 ? -1 : 1) as 1 | -1
      // Out from the spine toward the page's outer end.
      const outer = dir < 0 ? backZ : frontZ
      const length = Math.abs(outer - deck.frontZ)
      const zFar = dir < 0 ? deck.backZ : deck.frontZ - 0.1
      const zNear = dir < 0 ? deck.frontZ + 0.1 : outer
      return {
        deck,
        dir,
        outer,
        block: blockGeometry(deck.frontZ, dir, length),
        surface: surfaceGeometry(deck.frontZ, dir, length, zFar, zNear, 0.003),
        print: pageTexture(dir < 0, zFar, zNear),
      }
    })
    const popW = FIELD_HALF_WIDTH * 2
    const popH = WALL_HEIGHT + 2 - (PUSHER_HEIGHT + BACK_WALL_GAP) - 0.4
    return {
      pages,
      edges: edgeTexture(28),
      edgesAlong: edgeTexture(28, 'u'),
      leaf: leafTexture(),
      leafEdges: edgeTexture(26),
      popUp: popUpTexture(Math.round(popW * PX), Math.round(popH * PX)),
      popH,
      ribbon: ribbonGeometry(2.7, frontZ),
      stars: skyStars(60, 260),
    }
  }, [layout, backZ, frontZ])

  useEffect(
    () => () => {
      for (const p of art.pages) {
        p.block.dispose()
        p.surface.dispose()
        p.print.dispose()
      }
      for (const t of [art.edges, art.edgesAlong, art.leaf, art.leafEdges, art.popUp]) t.dispose()
      art.ribbon.dispose()
      art.stars.dispose()
    },
    [art]
  )

  useFrame(() => {
    const zs = game.engine.pusherZs()
    layout.forEach((deck, i) => leaves.current[i]?.position.set(0, deck.floorY, zs[i]))
  })

  const far = layout.find(d => !d.pusher.reversed) as Deck
  const near = layout.find(d => d.pusher.reversed) as Deck
  const wallBottom = PUSHER_HEIGHT + BACK_WALL_GAP
  const boardY = PAGE_BOTTOM_Y - BOARD_THICKNESS / 2
  const boardHalfX = FIELD_HALF_WIDTH + BOARD_LIP

  return (
    <>
      {/* The night: a deep blue dome with fixed stars, and the lamp's warm light. */}
      <mesh>
        <sphereGeometry args={[70, 32, 16]} />
        <meshBasicMaterial color={PALETTE.night} side={THREE.BackSide} />
      </mesh>
      <points geometry={art.stars}>
        <pointsMaterial color={PALETTE.star} size={0.35} sizeAttenuation />
      </points>
      <pointLight position={[-7, 9, 5]} color={PALETTE.lamp} intensity={140} decay={2} />
      <hemisphereLight args={[PALETTE.night, PALETTE.cover, 0.6]} />

      {/* Cloth-covered boards, one under each page, and the rounded spine between them. */}
      {art.pages.map(({ deck, dir, outer }) => {
        const from = deck.frontZ
        const to = outer + dir * BOARD_LIP
        return (
          <mesh key={`board-${from}`} position={[0, boardY, (from + to) / 2]}>
            <boxGeometry args={[boardHalfX * 2, BOARD_THICKNESS, Math.abs(to - from)]} />
            <meshStandardMaterial color={PALETTE.cover} roughness={0.85} />
          </mesh>
        )
      })}
      <mesh position={[0, boardY, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[0.85, 0.85, boardHalfX * 2, 24, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color={PALETTE.cover} roughness={0.85} side={THREE.DoubleSide} />
      </mesh>
      {/* The gutter's shadow, deep in the fold. */}
      <mesh position={[0, PAGE_BOTTOM_Y + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[FIELD_HALF_WIDTH * 2, Math.abs(near.frontZ - far.frontZ)]} />
        <meshBasicMaterial color={PALETTE.spine} />
      </mesh>
      {/* Gold edging along the boards' outer sides. */}
      {[-1, 1].map(side => (
        <mesh key={side} position={[side * boardHalfX, boardY, (backZ + frontZ) / 2]}>
          <boxGeometry args={[0.06, BOARD_THICKNESS + 0.02, frontZ - backZ + BOARD_LIP * 2]} />
          <meshStandardMaterial color={PALETTE.coverEdge} metalness={0.5} roughness={0.4} />
        </mesh>
      ))}

      {/* Each page: the paper block (its sides are the stacked page edges) and the printed top. */}
      {art.pages.map(({ deck, block, surface, print }) => (
        <group key={`page-${deck.frontZ}`}>
          <mesh geometry={block}>
            <meshStandardMaterial attach="material-0" map={art.edges} roughness={0.95} />
            <meshStandardMaterial attach="material-1" color={PALETTE.page} roughness={0.95} />
          </mesh>
          <mesh geometry={surface}>
            <meshStandardMaterial map={print} roughness={0.9} />
          </mesh>
        </group>
      ))}
      {/* The near end of the book faces the player: page edges there too. */}
      <mesh position={[0, PAGE_BOTTOM_Y / 2, frontZ + 0.002]}>
        <planeGeometry args={[FIELD_HALF_WIDTH * 2, -PAGE_BOTTOM_Y]} />
        <meshStandardMaterial map={art.edges} roughness={0.95} />
      </mesh>
      <mesh geometry={art.ribbon}>
        <meshStandardMaterial color={PALETTE.ribbon} roughness={0.6} side={THREE.DoubleSide} />
      </mesh>

      {/* The pushers: stacks of loose leaves, printed on top, page edges all round. */}
      {layout.map((deck, i) => (
        <group
          key={`leaves-${i}`}
          ref={g => {
            leaves.current[i] = g
          }}
        >
          <mesh position={[0, PUSHER_HEIGHT / 2, 0]}>
            <boxGeometry args={[FIELD_HALF_WIDTH * 2 - 0.04, PUSHER_HEIGHT, deck.pusher.depth]} />
            <meshStandardMaterial attach="material-0" map={art.edgesAlong} roughness={0.95} />
            <meshStandardMaterial attach="material-1" map={art.edgesAlong} roughness={0.95} />
            <meshStandardMaterial attach="material-2" map={art.leaf} roughness={0.9} />
            <meshStandardMaterial attach="material-3" color={PALETTE.pageEdge} />
            <meshStandardMaterial attach="material-4" map={art.leafEdges} roughness={0.95} />
            <meshStandardMaterial attach="material-5" map={art.leafEdges} roughness={0.95} />
          </mesh>
        </group>
      ))}

      {/* The far wall is a pop-up card standing on the page; the near one is
          clear (it would hide the table), marked only by a thin gold rail. */}
      <mesh position={[0, wallBottom + art.popH / 2, far.backZ + 0.01]}>
        <planeGeometry args={[FIELD_HALF_WIDTH * 2, art.popH]} />
        <meshStandardMaterial map={art.popUp} transparent alphaTest={0.5} roughness={0.9} />
      </mesh>
      <mesh position={[0, wallBottom + art.popH / 2, far.backZ - 0.03]}>
        <planeGeometry args={[FIELD_HALF_WIDTH * 2, art.popH]} />
        <meshStandardMaterial
          map={art.popUp}
          transparent
          alphaTest={0.5}
          color={PALETTE.pageEdge}
          side={THREE.BackSide}
        />
      </mesh>
      <mesh position={[0, wallBottom + 0.04, near.backZ]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, FIELD_HALF_WIDTH * 2, 10]} />
        <meshStandardMaterial color={PALETTE.coverEdge} metalness={0.5} roughness={0.4} />
      </mesh>
    </>
  )
}
