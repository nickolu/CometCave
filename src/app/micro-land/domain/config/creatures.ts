/**
 * The starter roster.
 *
 * These are written in exactly the format the LLM produces — plain object
 * literals, pushed through the same sanitizer. There is no "built-in creature"
 * code path; a summoned creature and a Sunleaf are the same kind of thing.
 *
 * The roster is a deliberate food chain. Plants feed grazers, grazers feed
 * hunters, and every population is capable of crashing:
 *
 *   sunleaf / bramble / kelp / sporecap   (plant)
 *     └─ mite, hopper, glimmer moth, finling, ember grub   (eat plant)
 *          └─ stalker, gulper, cinder wyrm, drifter jelly  (eat meat)
 */
import { sanitizeBlueprint } from '@/app/micro-land/domain/blueprint'
import type { CreatureBlueprint } from '@/app/micro-land/domain/types'

/** Same pipeline as a summoned creature, but with a stable id. */
function builtin(id: string, raw: unknown): CreatureBlueprint {
  return { ...sanitizeBlueprint(raw, { idPrefix: 'builtin' }), id, summoned: false }
}

// ---------------------------------------------------------------------------
// Plants — the bottom of every food chain. They spread instead of breeding.
// ---------------------------------------------------------------------------

const SUNLEAF = builtin('sunleaf', {
  name: 'Sunleaf',
  blurb: 'A little green sprout. Almost everything eats these.',
  size: 1,
  tags: ['plant'],
  art: {
    palette: { s: '#3f7d2a', l: '#7ede4f' },
    frames: [
      ['..l..', '.lsl.', '..s..', '.ls..', '..s..'],
      ['..l..', '.lsl.', '..s..', '..sl.', '..s..'],
    ],
    frameMs: 620,
    faceMotion: false,
  },
  body: { mass: 1, bounce: 0, drag: 0.2, buoyancy: 0.6, immuneTo: [] },
  move: { kind: 'root', speed: 0, jump: 0, restlessness: 0 },
  diet: {
    eats: [],
    fears: [],
    hungerRate: 0,
    starveSeconds: 999,
    breedAt: 0.2,
    lifespanSeconds: 260,
  },
  senses: { sight: 1 },
  habitat: { needs: null, drowns: false },
  dig: { through: [], speed: 1 },
  death: { becomes: null, particleColor: '#7ede4f', particleCount: 4 },
  glow: 0,
})

const BRAMBLE = builtin('bramble', {
  name: 'Bramble',
  blurb: 'A tangled berry bush. Bigger meals for bigger mouths.',
  size: 2,
  tags: ['plant'],
  art: {
    palette: { s: '#2f6b3a', l: '#57b04a', b: '#d1466f' },
    frames: [
      ['.l.b.l.', '.lslsl.', '..lsl..', '...s...', '..l.l..', '...s...'],
      ['.b.l.l.', '.lslsl.', '..lsl..', '...s...', '..l.l..', '...s...'],
    ],
    frameMs: 700,
    faceMotion: false,
  },
  body: { mass: 1, bounce: 0, drag: 0.2, buoyancy: 0.6, immuneTo: [] },
  move: { kind: 'root', speed: 0, jump: 0, restlessness: 0 },
  diet: {
    eats: [],
    fears: [],
    hungerRate: 0,
    starveSeconds: 999,
    breedAt: 0.2,
    lifespanSeconds: 340,
  },
  senses: { sight: 1 },
  habitat: { needs: null, drowns: false },
  dig: { through: [], speed: 1 },
  death: { becomes: null, particleColor: '#57b04a', particleCount: 5 },
  glow: 0,
})

const KELP = builtin('kelp', {
  name: 'Kelp',
  blurb: 'Slow ribbons of green that only grow underwater.',
  size: 1,
  tags: ['plant'],
  art: {
    palette: { k: '#2e8b6b', t: '#5fd6a8' },
    frames: [
      ['.t.', 'kt.', '.k.', '.kt', '.k.', 'tk.'],
      ['.t.', '.tk', '.k.', 'tk.', '.k.', '.kt'],
    ],
    frameMs: 520,
    faceMotion: false,
  },
  body: { mass: 1, bounce: 0, drag: 0.2, buoyancy: 0.6, immuneTo: [] },
  move: { kind: 'root', speed: 0, jump: 0, restlessness: 0 },
  diet: {
    eats: [],
    fears: [],
    hungerRate: 0,
    starveSeconds: 999,
    breedAt: 0.2,
    lifespanSeconds: 300,
  },
  senses: { sight: 1 },
  habitat: { needs: ['water'], drowns: false },
  dig: { through: [], speed: 1 },
  death: { becomes: null, particleColor: '#5fd6a8', particleCount: 4 },
  glow: 0,
})

const SPORECAP = builtin('sporecap', {
  name: 'Sporecap',
  blurb: 'A pale mushroom that glows faintly in the dark.',
  size: 1,
  tags: ['plant', 'fungus', 'glow'],
  art: {
    palette: { c: '#b9a6ff', s: '#efe7ff', d: '#6f5bb5' },
    frames: [
      ['.ccc.', 'ccccc', 'dcccd', '..s..', '..s..'],
      ['.ccc.', 'ccccc', 'dcccd', '..s..', '.ss..'],
    ],
    frameMs: 900,
    faceMotion: false,
  },
  body: { mass: 1, bounce: 0, drag: 0.2, buoyancy: 0.6, immuneTo: ['lava'] },
  move: { kind: 'root', speed: 0, jump: 0, restlessness: 0 },
  diet: {
    eats: [],
    fears: [],
    hungerRate: 0,
    starveSeconds: 999,
    breedAt: 0.2,
    lifespanSeconds: 400,
  },
  senses: { sight: 1 },
  habitat: { needs: null, drowns: false },
  dig: { through: [], speed: 1 },
  death: { becomes: null, particleColor: '#b9a6ff', particleCount: 6 },
  glow: 0.55,
})

// ---------------------------------------------------------------------------
// Grazers — eat plants, get eaten
// ---------------------------------------------------------------------------

const MITE = builtin('mite', {
  name: 'Mite',
  blurb: 'A speck with legs. Eats leaves, breeds fast, dies faster.',
  size: 1,
  tags: ['meat', 'bug'],
  art: {
    palette: { b: '#d2762b', e: '#ffe9c4' },
    frames: [
      ['.bb.', 'bbeb', 'b..b'],
      ['.bb.', 'bbeb', '.bb.'],
    ],
    frameMs: 130,
    faceMotion: true,
  },
  body: { mass: 1, bounce: 0.15, drag: 0.35, buoyancy: 0.8, immuneTo: [] },
  move: { kind: 'walk', speed: 4.5, jump: 6, restlessness: 0.5 },
  diet: {
    eats: ['plant'],
    fears: [],
    hungerRate: 0.034,
    starveSeconds: 18,
    breedAt: 0.7,
    lifespanSeconds: 110,
  },
  senses: { sight: 14 },
  habitat: { needs: null, drowns: true },
  dig: { through: [], speed: 1 },
  death: { becomes: null, particleColor: '#d2762b', particleCount: 4 },
  glow: 0,
})

const HOPPER = builtin('hopper', {
  name: 'Hopper',
  blurb: 'A springy grazer that bounds away from anything with teeth.',
  size: 2,
  tags: ['meat', 'bug'],
  art: {
    palette: { b: '#63c15a', d: '#2f7a34', e: '#ffffff' },
    frames: [
      ['..bb..', '.bbbbe', 'bbbbbb', '.d..d.', 'd....d'],
      ['..bb..', '.bbbbe', 'bbbbbb', '.dd.d.', '..d..d'],
    ],
    frameMs: 150,
    faceMotion: true,
  },
  body: { mass: 1, bounce: 0.2, drag: 0.4, buoyancy: 0.85, immuneTo: [] },
  move: { kind: 'walk', speed: 5, jump: 12, restlessness: 0.35 },
  diet: {
    eats: ['plant'],
    fears: [],
    hungerRate: 0.026,
    starveSeconds: 28,
    breedAt: 0.8,
    lifespanSeconds: 200,
  },
  senses: { sight: 20 },
  habitat: { needs: null, drowns: true },
  dig: { through: [], speed: 1 },
  death: { becomes: null, particleColor: '#63c15a', particleCount: 6 },
  glow: 0,
})

const GLIMMER_MOTH = builtin('glimmer-moth', {
  name: 'Glimmer Moth',
  blurb: 'Drifts through the air on soft wings, carrying its own little light.',
  size: 1,
  tags: ['meat', 'bug', 'glow'],
  art: {
    palette: { w: '#e6c9ff', b: '#7a5fb0', g: '#fff2a8' },
    frames: [
      ['w....w', 'ww..ww', '.wbbw.', '..bg..', '..bb..'],
      ['......', '.w..w.', 'wwbbww', 'w.bg.w', '..bb..'],
    ],
    frameMs: 110,
    faceMotion: true,
  },
  body: { mass: 0.1, bounce: 0.1, drag: 0.5, buoyancy: 1.4, immuneTo: [] },
  move: { kind: 'fly', speed: 4, jump: 0, restlessness: 0.6 },
  diet: {
    eats: ['plant'],
    fears: [],
    hungerRate: 0.03,
    starveSeconds: 26,
    breedAt: 0.75,
    lifespanSeconds: 170,
  },
  senses: { sight: 24 },
  habitat: { needs: null, drowns: true },
  dig: { through: [], speed: 1 },
  death: { becomes: null, particleColor: '#fff2a8', particleCount: 10 },
  glow: 0.7,
})

const FINLING = builtin('finling', {
  name: 'Finling',
  blurb: 'A small bright fish. Out of water it flops and gasps.',
  size: 2,
  tags: ['meat', 'fish'],
  art: {
    palette: { f: '#ffa62b', d: '#c4621a', e: '#ffffff' },
    frames: [
      ['d.ffff', 'dffffe', 'dfffff', 'd.ffff'],
      ['..ffff', '.ffffe', 'dfffff', 'd.ffff'],
    ],
    frameMs: 160,
    faceMotion: true,
  },
  body: { mass: 0.4, bounce: 0.1, drag: 0.45, buoyancy: 1, immuneTo: [] },
  move: { kind: 'swim', speed: 5, jump: 0, restlessness: 0.4 },
  diet: {
    eats: ['plant'],
    fears: [],
    hungerRate: 0.03,
    starveSeconds: 30,
    breedAt: 0.72,
    lifespanSeconds: 220,
  },
  senses: { sight: 20 },
  habitat: { needs: ['water'], drowns: false },
  dig: { through: [], speed: 1 },
  death: { becomes: null, particleColor: '#ffa62b', particleCount: 6 },
  glow: 0,
})

const EMBER_GRUB = builtin('ember-grub', {
  name: 'Ember Grub',
  blurb: 'Crawls over anything, even lava. Nothing burns it.',
  size: 2,
  tags: ['meat', 'bug'],
  art: {
    palette: { r: '#ff7a2f', d: '#8c2a10', y: '#ffd36b' },
    frames: [
      ['.rrrr.', 'rryyrr', 'rrrrry', '.d.d.d'],
      ['.rrrr.', 'rryyrr', 'rrrrry', 'd.d.d.'],
    ],
    frameMs: 170,
    faceMotion: true,
  },
  body: { mass: 1.2, bounce: 0, drag: 0.3, buoyancy: 0.5, immuneTo: ['lava'] },
  move: { kind: 'crawl', speed: 2.6, jump: 0, restlessness: 0.3 },
  diet: {
    eats: ['plant'],
    fears: [],
    hungerRate: 0.025,
    starveSeconds: 40,
    breedAt: 0.78,
    lifespanSeconds: 260,
  },
  senses: { sight: 16 },
  habitat: { needs: null, drowns: true },
  dig: { through: ['ash', 'sand', 'dirt'], speed: 1.6 },
  death: { becomes: 'ash', particleColor: '#ff7a2f', particleCount: 8 },
  glow: 0.35,
})

// ---------------------------------------------------------------------------
// Hunters — eat the grazers
// ---------------------------------------------------------------------------

const STALKER = builtin('stalker', {
  name: 'Stalker',
  blurb: 'Patient, hungry, and faster than it looks.',
  size: 3,
  tags: ['meat', 'beast'],
  art: {
    palette: { b: '#8c4459', d: '#40202c', e: '#ffd166' },
    frames: [
      ['..bbbb..', '.bbbbbbe', 'bbbbbbbb', '.dd..dd.', '.d....d.', '.d....d.'],
      ['..bbbb..', '.bbbbbbe', 'bbbbbbbb', '.dd..dd.', '.d....d.', '..d..d..'],
    ],
    frameMs: 170,
    faceMotion: true,
  },
  body: { mass: 1.4, bounce: 0.1, drag: 0.4, buoyancy: 0.8, immuneTo: [] },
  move: { kind: 'walk', speed: 6, jump: 10, restlessness: 0.2 },
  diet: {
    eats: ['meat'],
    fears: [],
    hungerRate: 0.022,
    starveSeconds: 50,
    breedAt: 0.85,
    lifespanSeconds: 340,
  },
  senses: { sight: 34 },
  habitat: { needs: null, drowns: true },
  dig: { through: [], speed: 1 },
  death: { becomes: null, particleColor: '#8c4459', particleCount: 10 },
  glow: 0,
})

const DRIFTER_JELLY = builtin('drifter-jelly', {
  name: 'Drifter Jelly',
  blurb: 'Floats wherever it likes and eats whatever bumps into it.',
  size: 2,
  tags: ['meat'],
  art: {
    palette: { j: '#8fd7ff', c: '#ffffff', t: '#5fa9d6' },
    frames: [
      ['.jjjj.', 'jjccjj', 'jjjjjj', '.tttt.', '.t.t.t', 't..t..'],
      ['.jjjj.', 'jjccjj', 'jjjjjj', '.tttt.', 't.t..t', '.t..t.'],
    ],
    frameMs: 260,
    faceMotion: false,
  },
  // Buoyancy just over 1 so it hangs at the waterline instead of bobbing up
  // out of the sea and drifting off into open sky.
  body: { mass: 0.15, bounce: 0.3, drag: 0.55, buoyancy: 1.03, immuneTo: [] },
  move: { kind: 'drift', speed: 1.8, jump: 0, restlessness: 0.5 },
  diet: {
    eats: ['bug'],
    fears: [],
    hungerRate: 0.02,
    starveSeconds: 55,
    breedAt: 0.85,
    lifespanSeconds: 300,
  },
  senses: { sight: 16 },
  habitat: { needs: null, drowns: false },
  dig: { through: [], speed: 1 },
  death: { becomes: null, particleColor: '#8fd7ff', particleCount: 12 },
  glow: 0.25,
})

const GULPER = builtin('gulper', {
  name: 'Gulper',
  blurb: 'The biggest thing in the water, and it knows it.',
  size: 4,
  tags: ['meat', 'fish'],
  art: {
    palette: { g: '#3f5f8a', d: '#22314a', e: '#ffe066' },
    frames: [
      ['..gggggg.', '.ggggggge', 'dggggggdd', 'dgggggggg', '.gggggggg', '..gggggg.'],
      ['..gggggg.', '.ggggggge', 'dgggggggg', 'dggggggdd', '.gggggggg', '..gggggg.'],
    ],
    frameMs: 240,
    faceMotion: true,
  },
  body: { mass: 0.6, bounce: 0.05, drag: 0.4, buoyancy: 1, immuneTo: [] },
  move: { kind: 'swim', speed: 4, jump: 0, restlessness: 0.25 },
  diet: {
    eats: ['fish', 'bug'],
    fears: [],
    hungerRate: 0.018,
    starveSeconds: 70,
    breedAt: 0.88,
    lifespanSeconds: 420,
  },
  senses: { sight: 30 },
  habitat: { needs: ['water'], drowns: false },
  dig: { through: [], speed: 1 },
  death: { becomes: null, particleColor: '#3f5f8a', particleCount: 12 },
  glow: 0,
})

const CINDER_WYRM = builtin('cinder-wyrm', {
  name: 'Cinder Wyrm',
  blurb: 'Swims through lava the way a fish swims through water.',
  size: 4,
  tags: ['meat', 'beast'],
  art: {
    palette: { r: '#e2551d', y: '#ffc247', d: '#5c1a08' },
    frames: [
      ['...rrrr..', '..rrrrrry', '.rrrrrrrr', 'drrrrrrd.', '.dd..dd..'],
      ['...rrrr..', '..rrrrrry', '.rrrrrrrr', '.drrrrrrd', '..dd..dd.'],
    ],
    frameMs: 190,
    faceMotion: true,
  },
  body: { mass: 1.6, bounce: 0.05, drag: 0.4, buoyancy: 0.9, immuneTo: ['lava'] },
  move: { kind: 'walk', speed: 4.5, jump: 9, restlessness: 0.2 },
  diet: {
    eats: ['meat'],
    fears: [],
    hungerRate: 0.02,
    starveSeconds: 60,
    breedAt: 0.9,
    lifespanSeconds: 380,
  },
  senses: { sight: 30 },
  habitat: { needs: null, drowns: true },
  dig: { through: ['stone', 'obsidian', 'ash', 'dirt', 'sand'], speed: 0.9 },
  death: { becomes: 'obsidian', particleColor: '#e2551d', particleCount: 14 },
  glow: 0.8,
})

const RUSTBOT = builtin('rustbot', {
  name: 'Rustbot',
  blurb: 'Somebody left it running. It eats scrap and keeps going.',
  size: 3,
  tags: ['mineral', 'metal'],
  art: {
    palette: { m: '#8a93a3', d: '#3d4553', e: '#66ffcc' },
    frames: [
      ['.mmmm.', 'mdeedm', 'mmmmmm', '.mmmm.', 'd.mm.d', 'd....d'],
      ['.mmmm.', 'mdeedm', 'mmmmmm', '.mmmm.', 'd.mm.d', '.d..d.'],
    ],
    frameMs: 200,
    faceMotion: true,
  },
  body: { mass: 2.2, bounce: 0, drag: 0.3, buoyancy: 0.2, immuneTo: [] },
  move: { kind: 'walk', speed: 2.4, jump: 6, restlessness: 0.15 },
  diet: {
    // Grinds up the fungus growing on its own hull. It used to eat "mineral",
    // a tag nothing but a Rustbot carries — and since nothing can eat its own
    // species, that quietly meant it could never eat anything at all.
    eats: ['fungus'],
    fears: [],
    hungerRate: 0.012,
    starveSeconds: 90,
    breedAt: 0.9,
    lifespanSeconds: 600,
  },
  senses: { sight: 26 },
  habitat: { needs: null, drowns: false },
  dig: { through: ['metal', 'glass', 'ice'], speed: 0.5 },
  death: { becomes: 'metal', particleColor: '#8a93a3', particleCount: 10 },
  glow: 0.2,
})


const DELVER = builtin('delver', {
  name: 'Delver',
  blurb: 'A blind digger that chews its own tunnels through soil and stone.',
  size: 2,
  tags: ['meat', 'beast'],
  art: {
    palette: { b: '#9a7b5f', d: '#5c4433', n: '#ffb4a8', c: '#e8e0d4' },
    frames: [
      ['.bbbbb.', 'cbbbbbn', 'cbbbbbb', '.ddd.d.'],
      ['.bbbbb.', 'cbbbbbn', 'cbbbbbb', '.d.ddd.'],
    ],
    frameMs: 160,
    faceMotion: true,
  },
  body: { mass: 1.3, bounce: 0, drag: 0.35, buoyancy: 0.6, immuneTo: [] },
  move: { kind: 'walk', speed: 3.2, jump: 5, restlessness: 0.4 },
  diet: {
    eats: ['plant'],
    fears: [],
    hungerRate: 0.028,
    starveSeconds: 34,
    breedAt: 0.8,
    lifespanSeconds: 240,
  },
  senses: { sight: 16 },
  habitat: { needs: null, drowns: true },
  dig: { through: ['dirt', 'grass', 'sand', 'ash'], speed: 2.2 },
  death: { becomes: null, particleColor: '#9a7b5f', particleCount: 6 },
  glow: 0,
})

export const BUILTIN_CREATURES: CreatureBlueprint[] = [
  SUNLEAF,
  BRAMBLE,
  KELP,
  SPORECAP,
  MITE,
  HOPPER,
  GLIMMER_MOTH,
  FINLING,
  EMBER_GRUB,
  DELVER,
  STALKER,
  DRIFTER_JELLY,
  GULPER,
  CINDER_WYRM,
  RUSTBOT,
]

export const BUILTIN_BY_ID: Record<string, CreatureBlueprint> = Object.fromEntries(
  BUILTIN_CREATURES.map((c) => [c.id, c])
)
