/* Picture Telephone: draw the finished chain onto one tall canvas and hand it
   to the share sheet (or a download). Browser only; layout.ts holds the math. */

import { layoutChain } from './layout'
import { withSvgSize } from './image-src'

import type { Block } from './layout'
import type { Entry, Seat } from '../types'

/** The one place canvas colors live. Values come from DESIGN.md tokens and the
    paper card colors in picture-telephone.css (canvas cannot read CSS variables). */
const COLORS = {
  background: '#0e0f1a', // surface
  panel: '#141624', // surface-container
  outline: '#2e3044', // outline-variant
  text: '#e4e1d6', // on-surface
  textSoft: '#c4c5d0', // on-surface-variant
  accent: '#00ffc2', // comet mint
  paper: '#f6efdc',
  paperEdge: '#e6dcc2',
  ink: '#221d2b',
  inkSoft: '#5e5768',
  badge: '#14d1ff', // signal cyan
  badgeInk: '#001e2b',
} as const

const FILE_NAME = 'picture-telephone.png'
const SHARE_TITLE = 'Picture Telephone'
const FOOTER_TEXT = 'Play at cometcave.com/picture-telephone'

interface Fonts {
  headline: string
  body: string
  label: string
}

function readFonts(): Fonts {
  const style = getComputedStyle(document.body)
  const pick = (name: string, fallback: string) => {
    const v = style.getPropertyValue(name).trim()
    return v ? `${v}, ${fallback}` : fallback
  }
  return {
    headline: pick('--font-headline', 'sans-serif'),
    body: pick('--font-body', 'sans-serif'),
    label: pick('--font-label', 'sans-serif'),
  }
}

function roundedPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r)
    return
  }
  // Path-based fallback for browsers without roundRect.
  const rr = Math.min(r, w / 2, h / 2)
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  try {
    const img = new Image()
    img.src = withSvgSize(src)
    if (typeof img.decode === 'function') {
      await img.decode()
    } else {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('image failed to load'))
      })
    }
    return img
  } catch {
    return null
  }
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  b: Block,
  fonts: Fonts,
  images: Map<string, HTMLImageElement | null>,
  dateLabel: string
) {
  ctx.textBaseline = 'alphabetic'
  switch (b.kind) {
    case 'header': {
      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'center'
      ctx.font = `700 64px ${fonts.headline}`
      ctx.fillText('Picture Telephone', b.w / 2, b.y + 92)
      ctx.fillStyle = COLORS.textSoft
      ctx.font = `400 30px ${fonts.body}`
      ctx.fillText(dateLabel, b.w / 2, b.y + 140)
      break
    }
    case 'connector': {
      const cx = b.x + b.w / 2
      ctx.strokeStyle = COLORS.accent
      ctx.fillStyle = COLORS.accent
      ctx.lineWidth = 6
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(cx, b.y + 10)
      ctx.lineTo(cx, b.y + b.h - 22)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx - 14, b.y + b.h - 26)
      ctx.lineTo(cx + 14, b.y + b.h - 26)
      ctx.lineTo(cx, b.y + b.h - 8)
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'text': {
      ctx.fillStyle = COLORS.paper
      roundedPath(ctx, b.x, b.y, b.w, b.h, 28)
      ctx.fill()
      const left = b.x + 32
      ctx.textAlign = 'left'
      ctx.fillStyle = COLORS.inkSoft
      ctx.font = `700 24px ${fonts.label}`
      const label = `${b.label.toUpperCase()} · ${b.name.toUpperCase()}`
      ctx.fillText(label, left, b.y + 32 + 28)
      if (b.ai) {
        const w = ctx.measureText(label).width
        ctx.font = `700 22px ${fonts.label}`
        const bw = ctx.measureText('AI').width + 24
        ctx.fillStyle = COLORS.badge
        roundedPath(ctx, left + w + 16, b.y + 32 + 4, bw, 34, 17)
        ctx.fill()
        ctx.fillStyle = COLORS.badgeInk
        ctx.fillText('AI', left + w + 28, b.y + 32 + 28)
      }
      ctx.fillStyle = COLORS.ink
      ctx.font = `400 40px ${fonts.body}`
      b.lines.forEach((line, i) => ctx.fillText(line, left, b.y + 32 + 44 + 40 + i * 56))
      break
    }
    case 'image': {
      const img = images.get(b.src) ?? null
      ctx.save()
      roundedPath(ctx, b.x, b.y, b.w, b.h, 24)
      ctx.clip()
      if (img) {
        ctx.drawImage(img, b.x, b.y, b.w, b.h)
      } else {
        ctx.fillStyle = COLORS.paperEdge
        ctx.fillRect(b.x, b.y, b.w, b.h)
        ctx.fillStyle = COLORS.inkSoft
        ctx.textAlign = 'center'
        ctx.font = `400 32px ${fonts.body}`
        ctx.fillText('Picture unavailable', b.x + b.w / 2, b.y + b.h / 2)
      }
      ctx.restore()
      ctx.strokeStyle = COLORS.outline
      ctx.lineWidth = 4
      roundedPath(ctx, b.x, b.y, b.w, b.h, 24)
      ctx.stroke()
      break
    }
    case 'footer': {
      ctx.fillStyle = COLORS.accent
      ctx.textAlign = 'center'
      ctx.font = `700 32px ${fonts.label}`
      ctx.fillText(FOOTER_TEXT, b.w / 2, b.y + 70)
      break
    }
  }
}

/** Compose the whole chain into one PNG file. The canvas is released before returning. */
export async function composeChainImage(entries: readonly Entry[], seats: readonly Seat[]): Promise<File> {
  if (typeof document === 'undefined') throw new Error('Sharing needs a browser.')
  if (document.fonts?.ready) await document.fonts.ready

  const fonts = readFonts()
  const measureCtx = document.createElement('canvas').getContext('2d')
  if (!measureCtx) throw new Error('Canvas is not available.')
  measureCtx.font = `400 40px ${fonts.body}`
  const names = Object.fromEntries(seats.map(s => [s.id, s.name]))
  const layout = layoutChain(entries, names, t => measureCtx.measureText(t).width)

  // Decode each distinct picture once, one at a time to keep memory flat.
  const images = new Map<string, HTMLImageElement | null>()
  for (const b of layout.blocks) {
    if (b.kind === 'image' && !images.has(b.src)) images.set(b.src, await loadImage(b.src))
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(layout.width * layout.scale)
  canvas.height = Math.floor(layout.height * layout.scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available.')

  try {
    ctx.scale(layout.scale, layout.scale)
    ctx.fillStyle = COLORS.background
    ctx.fillRect(0, 0, layout.width, layout.height)
    const dateLabel = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    for (const b of layout.blocks) drawBlock(ctx, b, fonts, images, dateLabel)

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('The picture could not be made.')
    return new File([blob], FILE_NAME, { type: 'image/png' })
  } finally {
    images.clear()
    canvas.width = 0
    canvas.height = 0
  }
}

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled'

export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Native share sheet when it can take a file; otherwise a download. Cancelling is silent. */
export async function shareOrDownload(file: File): Promise<ShareOutcome> {
  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: SHARE_TITLE })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
      // Anything else: fall through to a download.
    }
  }
  downloadFile(file)
  return 'downloaded'
}
