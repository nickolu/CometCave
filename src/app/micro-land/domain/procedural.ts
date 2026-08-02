/**
 * Offline creature generator.
 *
 * Two jobs. It's the fallback when there's no API key or the model call fails,
 * and it's the reason summoning never dead-ends: a kid typing "a purple fire
 * snail" always gets *something* purple and fire-proof back, even on a plane.
 *
 * It reads keywords out of the prompt, picks a body plan, and emits exactly the
 * same object literal shape the model would.
 */
import { sanitizeBlueprint } from './blueprint'

import type { CreatureBlueprint, LocomotionKind, MaterialId } from './types'

function hashString(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function hsl(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const c = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

const COLOR_WORDS: Record<string, number> = {
  red: 0,
  orange: 28,
  amber: 40,
  gold: 45,
  yellow: 52,
  lime: 85,
  green: 130,
  teal: 168,
  cyan: 185,
  blue: 215,
  indigo: 245,
  purple: 275,
  violet: 282,
  magenta: 305,
  pink: 335,
  rose: 345,
}

// --- body plans -------------------------------------------------------------

type Shape = (b: string, d: string, e: string) => string[][]

const SHAPES: Record<string, Shape> = {
  blob: (b, d, e) => [
    ['.bbbb.', 'bbbbbb', `bbb${e}bb`, 'bbbbbb', '.dddd.'].map(r =>
      r.replace(/b/g, b).replace(/d/g, d)
    ),
    ['.bbbb.', 'bbbbbb', `bbb${e}bb`, 'bbbbbb', '.d..d.'].map(r =>
      r.replace(/b/g, b).replace(/d/g, d)
    ),
  ],
  bug: (b, d, e) => [
    ['.bbbb.', `bbbbb${e}`, 'bbbbbb', 'd.dd.d'].map(r => r.replace(/b/g, b).replace(/d/g, d)),
    ['.bbbb.', `bbbbb${e}`, 'bbbbbb', '.dd.d.'].map(r => r.replace(/b/g, b).replace(/d/g, d)),
  ],
  fish: (b, d, e) => [
    ['d.bbbb.', `dbbbbb${e}`, 'dbbbbbb', 'd.bbbb.'].map(r => r.replace(/b/g, b).replace(/d/g, d)),
    ['..bbbb.', `.bbbbb${e}`, 'dbbbbbb', 'd.bbbb.'].map(r => r.replace(/b/g, b).replace(/d/g, d)),
  ],
  winged: (b, d, e) => [
    ['b.....b', 'bb...bb', '.bbbbb.', `..bb${e}..`, '..ddd..'].map(r =>
      r.replace(/b/g, b).replace(/d/g, d)
    ),
    ['.......', '.b...b.', 'bbbbbbb', `b.bb${e}.b`, '..ddd..'].map(r =>
      r.replace(/b/g, b).replace(/d/g, d)
    ),
  ],
  beast: (b, d, e) => [
    ['..bbbb..', `.bbbbbb${e}`, 'bbbbbbbb', '.dd..dd.', '.d....d.', '.d....d.'].map(r =>
      r.replace(/b/g, b).replace(/d/g, d)
    ),
    ['..bbbb..', `.bbbbbb${e}`, 'bbbbbbbb', '.dd..dd.', '.d....d.', '..d..d..'].map(r =>
      r.replace(/b/g, b).replace(/d/g, d)
    ),
  ],
  plant: (b, d, e) => [
    ['..b..', `.b${e}b.`, '..d..', '.bd..', '..d..', '..d..'].map(r =>
      r.replace(/b/g, b).replace(/d/g, d)
    ),
    ['..b..', `.b${e}b.`, '..d..', '..db.', '..d..', '..d..'].map(r =>
      r.replace(/b/g, b).replace(/d/g, d)
    ),
  ],
  orb: (b, d, e) => [
    ['.bbb.', `bb${e}bb`, 'bbbbb', 'bbbbb', '.bbb.'].map(r => r.replace(/b/g, b).replace(/d/g, d)),
    ['.ddd.', `db${e}bd`, 'dbbbd', 'dbbbd', '.ddd.'].map(r => r.replace(/b/g, b).replace(/d/g, d)),
  ],
}

// --- keyword reading --------------------------------------------------------

interface Read {
  kind: LocomotionKind
  shape: keyof typeof SHAPES
  /** Springiness for walkers — see `CreatureMove.hop`. */
  hop: number
  eats: string[]
  tags: string[]
  size: number
  immuneTo: MaterialId[]
  needs: MaterialId[] | null
  glow: number
  hue: number | null
}

function readPrompt(prompt: string): Read {
  const lower = ` ${prompt.toLowerCase()} `

  // Split "a snail that eats moss" into what it IS and what it EATS. Without
  // this the body-plan keywords match on the food — "moss" makes the snail a
  // plant — and you get a rooted shrub instead of an animal.
  const eatsMatch = lower.match(/\b(?:that\s+)?(?:eats|eating|feeds\s+on|munches)\b/)
  const t = eatsMatch ? lower.slice(0, eatsMatch.index) : lower
  const food = eatsMatch ? lower.slice((eatsMatch.index ?? 0) + eatsMatch[0].length) : ''

  const has = (...words: string[]) => words.some(word => t.includes(word))
  const foodHas = (...words: string[]) => words.some(word => food.includes(word))

  let kind: LocomotionKind = 'walk'
  let shape: keyof typeof SHAPES = 'blob'

  if (has('plant', 'tree', 'flower', 'vine', 'moss', 'mushroom', 'fungus', 'coral', 'seed')) {
    kind = 'root'
    shape = 'plant'
  } else if (has('fish', 'shark', 'eel', 'squid', 'octopus', 'whale', 'seahorse')) {
    kind = 'swim'
    shape = 'fish'
  } else if (has('bird', 'moth', 'butterfly', 'bat', 'fairy', 'dragon', 'wasp', 'bee', 'fly')) {
    kind = 'fly'
    shape = 'winged'
  } else if (has('snail', 'slug', 'spider', 'worm', 'grub', 'crawl', 'centipede')) {
    kind = 'crawl'
    shape = 'bug'
  } else if (has('jelly', 'balloon', 'cloud', 'ghost', 'spirit', 'float', 'drift', 'bubble')) {
    kind = 'drift'
    shape = 'orb'
  } else if (has('wolf', 'cat', 'dog', 'bear', 'lion', 'tiger', 'beast', 'monster', 'hound')) {
    kind = 'walk'
    shape = 'beast'
  } else if (has('bug', 'beetle', 'ant', 'mite', 'roach', 'cricket')) {
    kind = 'walk'
    shape = 'bug'
  }

  // Springiness rides on top of the body plan rather than replacing it, so a
  // "hopping mushroom" is still rooted and a frog is still a walker. This is the
  // fallback creature — the one a child gets when the summon fails — and asking
  // for a frog and being handed something that plods is the moment they notice
  // nobody was really listening. Matching on 'hop' as a substring picks up
  // grasshopper and hopper along the way, which is the intent.
  const hop = has('frog', 'toad', 'rabbit', 'bunny', 'hare', 'kangaroo', 'flea', 'hop', 'bounce')
    ? 1
    : has('cricket', 'locust', 'spring', 'jump', 'leap')
      ? 0.6
      : 0

  // Diet. An explicit "eats ..." clause wins; otherwise anything that sounds
  // toothy eats meat and the rest graze.
  const eatsMeat = foodHas('meat', 'bug', 'fish', 'bird', 'animal', 'creature', 'flesh')
  const eatsPlant = foodHas(
    'plant',
    'moss',
    'leaf',
    'leaves',
    'grass',
    'fungus',
    'mushroom',
    'algae',
    'kelp',
    'seed',
    'fruit'
  )
  const predator =
    eatsMeat ||
    (!eatsPlant &&
      has(
        'predator',
        'hunt',
        'carnivore',
        'fangs',
        'teeth',
        'claws',
        'fierce',
        'shark',
        'wolf',
        'lion',
        'tiger',
        'monster',
        'dragon',
        'spider'
      ))
  const eats = kind === 'root' ? [] : predator ? ['meat'] : ['plant']

  let size = kind === 'root' ? 1 : predator ? 3 : 2
  if (has('tiny', 'small', 'little', 'mini', 'micro', 'baby')) size = 1
  if (has('big', 'large', 'giant', 'huge', 'massive', 'enormous', 'king')) size = 5

  const fireproof = has('fire', 'flame', 'lava', 'magma', 'ember', 'cinder', 'molten', 'volcano')
  const glow = has('glow', 'light', 'lumin', 'shine', 'star', 'neon', 'spark', 'ghost') ? 0.7 : 0

  let hue: number | null = null
  for (const [word, h] of Object.entries(COLOR_WORDS)) {
    if (t.includes(word)) {
      hue = h
      break
    }
  }
  if (hue === null && fireproof) hue = 18

  const tags = [kind === 'root' ? 'plant' : 'meat']
  if (shape === 'bug') tags.push('bug')
  if (shape === 'fish') tags.push('fish')
  if (shape === 'winged') tags.push('bug')
  if (shape === 'beast') tags.push('beast')
  if (glow > 0) tags.push('glow')

  return {
    kind,
    shape,
    hop,
    eats,
    tags,
    size,
    immuneTo: fireproof ? ['lava'] : [],
    needs: kind === 'swim' ? ['water'] : null,
    glow,
    hue,
  }
}

function titleCase(input: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/** Build a complete blueprint from a description, with no model involved. */
export function proceduralCreature(prompt: string): CreatureBlueprint {
  const seed = hashString(prompt)
  const read = readPrompt(prompt)

  const hue = read.hue ?? seed % 360
  const body = hsl(hue, 0.62, 0.55)
  const shade = hsl(hue, 0.55, 0.32)
  const eye = read.glow > 0 ? hsl((hue + 40) % 360, 1, 0.85) : '#ffffff'

  const frames = SHAPES[read.shape]('b', 'd', 'e')

  const name = titleCase(prompt.replace(/[^a-zA-Z ]/g, '').trim()) || 'Mystery Thing'

  return sanitizeBlueprint(
    {
      name,
      blurb: `Summoned from the words "${prompt.trim().slice(0, 60)}".`,
      size: read.size,
      tags: read.tags,
      art: {
        palette: { b: body, d: shade, e: eye },
        frames,
        frameMs: read.kind === 'fly' ? 120 : 200,
        faceMotion: read.kind !== 'root' && read.shape !== 'orb',
      },
      body: {
        mass: read.kind === 'fly' ? 0.2 : read.kind === 'drift' ? 0.15 : 1,
        bounce: read.kind === 'drift' ? 0.35 : 0.12,
        drag: 0.4,
        buoyancy: read.kind === 'drift' ? 1.25 : 0.9,
        immuneTo: read.immuneTo,
      },
      move: {
        kind: read.kind,
        speed: read.kind === 'root' ? 0 : 3 + (seed % 5),
        jump: 9,
        hop: read.hop,
        restlessness: 0.3,
      },
      diet: {
        eats: read.eats,
        fears: [],
        hungerRate: read.kind === 'root' ? 0 : 0.03,
        starveSeconds: read.kind === 'root' ? 999 : 30,
        breedAt: read.kind === 'root' ? 0.25 : 0.75,
        lifespanSeconds: 220 + (seed % 160),
      },
      senses: { sight: 18 },
      habitat: { needs: read.needs, drowns: read.kind !== 'swim' },
      death: {
        becomes: null,
        particleColor: body,
        particleCount: 7,
      },
      glow: read.glow,
    },
    { summoned: true }
  )
}

/** A small self-contained food chain, for scene mode without a model. */
export function proceduralScene(prompt: string): {
  title: string
  note: string
  creatures: (CreatureBlueprint & { count: number })[]
} {
  const base = proceduralCreature(prompt)
  const grazer = proceduralCreature(`${prompt} tiny grazer`)
  const grower = proceduralCreature(`${prompt} glowing moss plant`)

  return {
    title: titleCase(prompt) || 'A Small World',
    note: 'Made without the summoning circle — the plants feed the grazers, and the big one eats both.',
    creatures: [
      { ...grower, count: 16 },
      { ...grazer, count: 10 },
      { ...base, count: 3 },
    ],
  }
}
