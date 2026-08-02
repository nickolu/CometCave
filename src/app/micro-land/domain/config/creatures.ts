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
 *   sunleaf / bramble / kelp / sporecap / frostcap / glowvine / skybloom
 *     └─ mite, hopper, glimmer moth, finling, ember grub, delver, mote,
 *        palecrawler, driftmole, woolly, dustbee, loamworm, crystal snail
 *          └─ stalker, gulper, cinder wyrm, drifter jelly, rimeclaw,
 *             sunhawk, gloomweaver, wisp, grumblestone
 *
 * Two of them are *helpers*: a Dustbee makes nearby plants spread faster and a
 * Loamworm turns bare stone into soil. They are the only creatures here that
 * change the world rather than just live in it, and they do it through the same
 * plain `aura` data any summoned creature can carry.
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
    palette: { a: '#ffd166', b: '#3f7d2a' },
    frames: [
      ['.a.', 'aba', '.b.', 'ab.', '.b.'],
      ['.a.', 'aba', '.b.', '.ba', '.b.'],
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
    starveSeconds: 300,
    breedAt: 0.2,
    lifespanSeconds: 260,
  },
  senses: { sight: 1 },
  habitat: { needs: null, drowns: false },
  dig: { through: [], speed: 1 },
  death: { becomes: null, particleColor: '#ffd166', particleCount: 6 },
  aura: null,
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
  aura: null,
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
  aura: null,
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
  aura: null,
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
  aura: null,
  glow: 0,
})

const HOPPER = builtin('hopper', {
  name: 'Hopper',
  blurb: 'A springy grazer that bounds away from anything with teeth.',
  size: 2,
  tags: ['meat', 'bug'],
  art: {
    palette: { a: '#63c15a', b: '#2f7a34', c: '#ffffff', d: '#1b1b26' },
    frames: [
      ['..aa..', '.aaaac', 'aaaaaa', '.b..b.', 'b....b'],
      ['..aa..', '.aaaac', 'aaaaaa', '.bb.b.', '..b.bd'],
      ['..aa..', '.aaaac', 'aaaaaa', '.b..b.', 'b....b'],
      ['..aa..', '.aaaaa', 'aaaaaa', '.bb.b.', '..b..b'],
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
  death: { becomes: null, particleColor: '#63c15a', particleCount: 8 },
  aura: null,
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
  aura: null,
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
  aura: null,
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
  aura: null,
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
  aura: null,
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
  aura: null,
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
  aura: null,
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
  aura: null,
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
  aura: null,
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
  aura: null,
  glow: 0,
})

// ---------------------------------------------------------------------------
// The cold set — a food chain that works on snow
// ---------------------------------------------------------------------------

const FROSTCAP = builtin('frostcap', {
  name: 'Frostcap',
  blurb: 'A stiff little shrub that only bothers growing where it is cold.',
  size: 1,
  tags: ['plant'],
  art: {
    palette: { i: '#bfe6f7', w: '#ffffff', s: '#7fb8d4' },
    frames: [
      ['..w..', '.iwi.', 'iisii', '..s..', '..s..'],
      ['..w..', '.iwi.', 'isiii', '..s..', '..s..'],
    ],
    frameMs: 780,
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
    lifespanSeconds: 320,
  },
  senses: { sight: 1 },
  habitat: { needs: null, drowns: false },
  dig: { through: [], speed: 1 },
  death: { becomes: null, particleColor: '#bfe6f7', particleCount: 4 },
  aura: null,
  glow: 0.05,
})

const WOOLLY = builtin('woolly', {
  name: 'Woolly',
  blurb: 'A round, patient grazer wearing far too many coats.',
  size: 3,
  tags: ['meat', 'beast'],
  art: {
    palette: { w: '#f2ece0', d: '#9c8b76', e: '#3b3229' },
    frames: [
      ['.wwwww..', 'wwwwwwwe', 'wwwwwwww', '.wwwwww.', '.d.d.dd.', '.d.d.d..'],
      ['.wwwww..', 'wwwwwwwe', 'wwwwwwww', '.wwwwww.', '.dd.d.d.', '..d.d.d.'],
    ],
    frameMs: 240,
    faceMotion: true,
  },
  body: { mass: 1.6, bounce: 0.05, drag: 0.35, buoyancy: 0.9, immuneTo: [] },
  move: { kind: 'walk', speed: 3, jump: 6, restlessness: 0.2 },
  diet: {
    eats: ['plant'],
    fears: [],
    hungerRate: 0.02,
    starveSeconds: 45,
    breedAt: 0.82,
    lifespanSeconds: 300,
  },
  senses: { sight: 18 },
  habitat: { needs: null, drowns: true },
  dig: { through: ['snow'], speed: 1.4 },
  death: { becomes: null, particleColor: '#f2ece0', particleCount: 8 },
  aura: null,
  glow: 0,
})

const DRIFTMOLE = builtin('driftmole', {
  name: 'Driftmole',
  blurb: 'Tunnels under the snow and pops up somewhere else entirely.',
  size: 2,
  tags: ['meat', 'beast'],
  art: {
    palette: { b: '#8ea3b8', d: '#4f5f70', n: '#ffc0cb', c: '#e8eef5' },
    frames: [
      ['.bbbbb.', 'cbbbbbn', 'cbbbbbb', '.dd.dd.'],
      ['.bbbbb.', 'cbbbbbn', 'cbbbbbb', '.d.ddd.'],
    ],
    frameMs: 150,
    faceMotion: true,
  },
  body: { mass: 1.2, bounce: 0, drag: 0.35, buoyancy: 0.6, immuneTo: [] },
  move: { kind: 'walk', speed: 3.4, jump: 5, restlessness: 0.4 },
  diet: {
    eats: ['plant'],
    fears: [],
    hungerRate: 0.028,
    starveSeconds: 34,
    breedAt: 0.8,
    lifespanSeconds: 230,
  },
  senses: { sight: 16 },
  habitat: { needs: null, drowns: true },
  dig: { through: ['snow', 'ice', 'dirt', 'mud'], speed: 2.4 },
  death: { becomes: null, particleColor: '#8ea3b8', particleCount: 6 },
  aura: null,
  glow: 0,
})

const RIMECLAW = builtin('rimeclaw', {
  name: 'Rimeclaw',
  blurb: 'Quiet on the snow, and it knows exactly how quiet it is.',
  size: 4,
  tags: ['meat', 'beast'],
  art: {
    palette: { b: '#9fc6dd', d: '#3f5f78', e: '#ffe9a8', w: '#e8f5ff' },
    frames: [
      ['..bbbbb..', '.bbbbbbbe', 'bwbbbbbbb', '.dd...dd.', '.d.....d.', '.d.....d.'],
      ['..bbbbb..', '.bbbbbbbe', 'bwbbbbbbb', '.dd...dd.', '.d.....d.', '..d...d..'],
    ],
    frameMs: 180,
    faceMotion: true,
  },
  body: { mass: 1.5, bounce: 0.1, drag: 0.4, buoyancy: 0.8, immuneTo: [] },
  move: { kind: 'walk', speed: 5.6, jump: 10, restlessness: 0.2 },
  diet: {
    eats: ['meat'],
    fears: [],
    hungerRate: 0.02,
    starveSeconds: 55,
    breedAt: 0.88,
    lifespanSeconds: 360,
  },
  senses: { sight: 32 },
  habitat: { needs: null, drowns: true },
  dig: { through: ['snow'], speed: 1.8 },
  death: { becomes: null, particleColor: '#9fc6dd', particleCount: 10 },
  aura: null,
  glow: 0,
})

// ---------------------------------------------------------------------------
// The sky set — the open air was the emptiest part of the world
// ---------------------------------------------------------------------------

/**
 * A plant that flies.
 *
 * `root` would be the honest locomotion for a plant, but a rooted thing has to
 * settle onto fertile ground to exist at all — which is exactly what this one
 * hasn't got. Flying instead, with a hunger rate of zero, gets a plant that
 * lives in open air: it never starves, and because breeding costs fullness it
 * can never pay back, each Skybloom seeds roughly once and then just drifts.
 */
const SKYBLOOM = builtin('skybloom', {
  name: 'Skybloom',
  blurb: 'A flower that never landed. It just keeps floating.',
  size: 2,
  tags: ['plant', 'sky'],
  art: {
    palette: { p: '#ffd7ef', s: '#a8e6cf', g: '#ffffff' },
    frames: [
      ['.pppp.', 'pppggp', 'pppppp', '.pppp.', '..ss..', '.s..s.'],
      ['.pppp.', 'pgppgp', 'pppppp', '.pppp.', '..ss..', '..s.s.'],
    ],
    frameMs: 640,
    faceMotion: false,
  },
  body: { mass: 0.05, bounce: 0.2, drag: 0.5, buoyancy: 1.2, immuneTo: [] },
  move: { kind: 'fly', speed: 0.9, jump: 0, restlessness: 0.12 },
  diet: {
    eats: [],
    fears: [],
    hungerRate: 0,
    starveSeconds: 999,
    breedAt: 0.6,
    lifespanSeconds: 340,
  },
  senses: { sight: 2 },
  habitat: { needs: null, drowns: true },
  dig: { through: [], speed: 1 },
  death: { becomes: null, particleColor: '#ffd7ef', particleCount: 8 },
  aura: null,
  glow: 0.1,
})

const MOTE = builtin('mote', {
  name: 'Mote',
  blurb: 'A crumb of light with wings. Never seems to be alone.',
  size: 1,
  tags: ['meat', 'bug'],
  art: {
    palette: { y: '#fff2a8', o: '#e6b93f' },
    frames: [
      ['.yy.', 'yoyy', '.yy.'],
      ['.yy.', 'yyoy', 'y..y'],
    ],
    frameMs: 100,
    faceMotion: true,
  },
  body: { mass: 0.08, bounce: 0.1, drag: 0.5, buoyancy: 1.3, immuneTo: [] },
  move: { kind: 'fly', speed: 5, jump: 0, restlessness: 0.75 },
  diet: {
    eats: ['plant'],
    fears: [],
    hungerRate: 0.034,
    starveSeconds: 20,
    breedAt: 0.7,
    lifespanSeconds: 120,
  },
  senses: { sight: 22 },
  habitat: { needs: null, drowns: true },
  dig: { through: [], speed: 1 },
  death: { becomes: null, particleColor: '#fff2a8', particleCount: 5 },
  aura: null,
  glow: 0.3,
})

const SUNHAWK = builtin('sunhawk', {
  name: 'Sunhawk',
  blurb: 'Rides the high air all day and drops on whatever it spots.',
  size: 4,
  tags: ['meat', 'bird'],
  art: {
    palette: { b: '#c9762f', d: '#6b3a12', e: '#fff0b8', w: '#f0b45f' },
    frames: [
      ['ww.....ww', '.wwbbbww.', '..bbbbbe.', '...bbb...', '...d.d...'],
      ['.........', 'ww.bbb.ww', '.wbbbbbe.', '..wbbbw..', '...d.d...'],
    ],
    frameMs: 130,
    faceMotion: true,
  },
  body: { mass: 0.5, bounce: 0.1, drag: 0.45, buoyancy: 1.1, immuneTo: [] },
  move: { kind: 'fly', speed: 7, jump: 0, restlessness: 0.3 },
  diet: {
    eats: ['bug', 'meat'],
    fears: [],
    hungerRate: 0.019,
    starveSeconds: 60,
    breedAt: 0.88,
    lifespanSeconds: 380,
  },
  // Sight is what makes a flier fearsome: nothing else in the world can cross
  // the map unobstructed. At 40 tiles it could see a third of the world at once
  // and cleared out every grazer in it, so it hunts by patrolling instead.
  senses: { sight: 26 },
  habitat: { needs: null, drowns: true },
  dig: { through: [], speed: 1 },
  death: { becomes: null, particleColor: '#c9762f', particleCount: 12 },
  aura: null,
  glow: 0,
})

// ---------------------------------------------------------------------------
// The cave set — makes the dark worth going into
// ---------------------------------------------------------------------------

const GLOWVINE = builtin('glowvine', {
  name: 'Glowvine',
  blurb: 'Hangs in the dark and lights its own little room.',
  size: 1,
  tags: ['plant', 'glow'],
  art: {
    palette: { v: '#3f8f6f', l: '#8ffcd0', d: '#276b52' },
    frames: [
      ['..l..', '.lvl.', '..v..', '.lv..', '..v..', '..d..'],
      ['..l..', '.lvl.', '..v..', '..vl.', '..v..', '..d..'],
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
    lifespanSeconds: 380,
  },
  senses: { sight: 1 },
  habitat: { needs: null, drowns: false },
  dig: { through: [], speed: 1 },
  death: { becomes: null, particleColor: '#8ffcd0', particleCount: 6 },
  aura: null,
  glow: 0.62,
})

const PALECRAWLER = builtin('palecrawler', {
  name: 'Palecrawler',
  blurb: 'Walks upside down along cave ceilings and never looks down.',
  size: 2,
  tags: ['meat', 'bug'],
  art: {
    palette: { p: '#ded3c4', d: '#8c8072', e: '#ff9c9c' },
    frames: [
      ['.ppppp.', 'ppppppe', 'ppppppp', 'd.d.d.d'],
      ['.ppppp.', 'ppppppe', 'ppppppp', '.d.d.d.'],
    ],
    frameMs: 160,
    faceMotion: true,
  },
  body: { mass: 0.9, bounce: 0.1, drag: 0.35, buoyancy: 0.8, immuneTo: [] },
  move: { kind: 'crawl', speed: 3.4, jump: 0, restlessness: 0.35 },
  diet: {
    eats: ['plant', 'fungus'],
    fears: [],
    hungerRate: 0.026,
    starveSeconds: 32,
    breedAt: 0.78,
    lifespanSeconds: 220,
  },
  senses: { sight: 16 },
  habitat: { needs: null, drowns: true },
  dig: { through: [], speed: 1 },
  death: { becomes: null, particleColor: '#ded3c4', particleCount: 6 },
  aura: null,
  glow: 0,
})

const GLOOMWEAVER = builtin('gloomweaver', {
  name: 'Gloomweaver',
  blurb: 'Waits on the ceiling. Patient about it, too.',
  size: 3,
  tags: ['meat', 'bug'],
  art: {
    palette: { b: '#4b3b5a', d: '#221a2e', e: '#ff5f8f' },
    frames: [
      ['d......d', '.dbbbbd.', 'dbbeebbd', '.dbbbbd.', 'd..dd..d'],
      ['.d....d.', 'd.bbbb.d', 'dbbeebbd', 'd.bbbb.d', '.d.dd.d.'],
    ],
    frameMs: 210,
    faceMotion: true,
  },
  body: { mass: 1, bounce: 0.05, drag: 0.4, buoyancy: 0.8, immuneTo: [] },
  move: { kind: 'crawl', speed: 4.4, jump: 0, restlessness: 0.15 },
  diet: {
    eats: ['bug'],
    fears: [],
    hungerRate: 0.021,
    starveSeconds: 55,
    breedAt: 0.86,
    lifespanSeconds: 330,
  },
  senses: { sight: 30 },
  habitat: { needs: null, drowns: true },
  dig: { through: [], speed: 1 },
  death: { becomes: null, particleColor: '#4b3b5a', particleCount: 10 },
  aura: null,
  glow: 0,
})

// ---------------------------------------------------------------------------
// Helpers — the only creatures that change the world instead of just eating it
// ---------------------------------------------------------------------------

const DUSTBEE = builtin('dustbee', {
  name: 'Dustbee',
  blurb: 'Carries flower dust from plant to plant. Everything grows faster near it.',
  size: 1,
  tags: ['meat', 'bug'],
  art: {
    palette: { y: '#ffd94a', d: '#3a2f10', w: '#fffbe8' },
    frames: [
      ['.ww..', '.yyy.', 'ydydy', '..d..'],
      ['..ww.', '.yyy.', 'ydydy', '.d...'],
    ],
    frameMs: 90,
    faceMotion: true,
  },
  body: { mass: 0.1, bounce: 0.1, drag: 0.5, buoyancy: 1.2, immuneTo: [] },
  move: { kind: 'fly', speed: 5.5, jump: 0, restlessness: 0.65 },
  diet: {
    eats: ['plant'],
    fears: [],
    hungerRate: 0.028,
    starveSeconds: 26,
    breedAt: 0.72,
    lifespanSeconds: 190,
  },
  senses: { sight: 26 },
  habitat: { needs: null, drowns: true },
  dig: { through: [], speed: 1 },
  death: { becomes: null, particleColor: '#ffd94a', particleCount: 6 },
  aura: { radius: 20, helps: ['plant'], boost: 2.4, converts: null, convertRate: 0 },
  glow: 0,
})

const LOAMWORM = builtin('loamworm', {
  name: 'Loamworm',
  blurb: 'Chews bare rock and leaves good soil behind it.',
  size: 2,
  tags: ['meat', 'bug'],
  art: {
    palette: { p: '#d99a8a', d: '#a86b5c', e: '#5c3a30' },
    frames: [
      ['.ppppp.', 'pppppde', '.ppppp.'],
      ['..pppp.', 'pppppde', '..pppp.'],
    ],
    frameMs: 200,
    faceMotion: true,
  },
  body: { mass: 1.1, bounce: 0, drag: 0.3, buoyancy: 0.7, immuneTo: [] },
  move: { kind: 'walk', speed: 2.2, jump: 3, restlessness: 0.35 },
  diet: {
    eats: ['plant'],
    fears: [],
    hungerRate: 0.022,
    starveSeconds: 40,
    breedAt: 0.82,
    lifespanSeconds: 280,
  },
  senses: { sight: 12 },
  habitat: { needs: null, drowns: true },
  dig: { through: ['dirt', 'sand', 'ash', 'stone', 'mud'], speed: 1.6 },
  death: { becomes: 'mud', particleColor: '#d99a8a', particleCount: 6 },
  aura: {
    radius: 7,
    helps: [],
    boost: 1,
    converts: { from: 'stone', to: 'dirt' },
    convertRate: 0.35,
  },
  glow: 0,
})

// ---------------------------------------------------------------------------
// The fantasy set
// ---------------------------------------------------------------------------

const WISP = builtin('wisp', {
  name: 'Wisp',
  blurb: 'A wandering light. Nobody is sure it is really an animal.',
  size: 1,
  tags: ['meat', 'spirit', 'glow'],
  art: {
    palette: { c: '#cfefff', w: '#ffffff', b: '#7fb6ff' },
    frames: [
      ['..w..', '.wcw.', 'wcccw', '.bcb.', '..b..'],
      ['..w..', '.wcw.', 'wcccw', '.bcb.', '.b.b.'],
    ],
    frameMs: 300,
    faceMotion: false,
  },
  body: { mass: 0.05, bounce: 0.3, drag: 0.55, buoyancy: 1.3, immuneTo: ['lava'] },
  move: { kind: 'drift', speed: 2.4, jump: 0, restlessness: 0.55 },
  diet: {
    eats: ['bug'],
    fears: [],
    hungerRate: 0.014,
    starveSeconds: 70,
    breedAt: 0.86,
    lifespanSeconds: 400,
  },
  senses: { sight: 26 },
  habitat: { needs: null, drowns: false },
  dig: { through: [], speed: 1 },
  death: { becomes: null, particleColor: '#cfefff', particleCount: 14 },
  aura: null,
  glow: 1,
})

const GRUMBLESTONE = builtin('grumblestone', {
  name: 'Grumblestone',
  blurb: 'A boulder that got up. Slow, heavy, and takes a lot of feeding.',
  size: 5,
  tags: ['meat', 'beast', 'mineral'],
  art: {
    palette: { s: '#6b7280', d: '#3d434d', m: '#8a929e', e: '#ffd166' },
    frames: [
      [
        '..ssssss..',
        '.smmmmmms.',
        'smmmmeems.',
        '.smmmmmms.',
        '..ssssss..',
        '.dd....dd.',
        '.d......d.',
      ],
      [
        '..ssssss..',
        '.smmmmmms.',
        'smmmmeems.',
        '.smmmmmms.',
        '..ssssss..',
        '.dd....dd.',
        '..d....d..',
      ],
    ],
    frameMs: 320,
    faceMotion: true,
  },
  body: { mass: 3, bounce: 0, drag: 0.25, buoyancy: 0.2, immuneTo: ['lava'] },
  move: { kind: 'walk', speed: 2, jump: 5, restlessness: 0.1 },
  diet: {
    eats: ['meat'],
    fears: [],
    hungerRate: 0.011,
    starveSeconds: 100,
    breedAt: 0.92,
    lifespanSeconds: 620,
  },
  senses: { sight: 24 },
  habitat: { needs: null, drowns: false },
  dig: { through: ['stone', 'dirt', 'ash', 'mud', 'obsidian'], speed: 0.7 },
  death: { becomes: 'stone', particleColor: '#6b7280', particleCount: 14 },
  aura: null,
  glow: 0,
})

const CRYSTAL_SNAIL = builtin('crystal-snail', {
  name: 'Crystal Snail',
  blurb: 'Grazes on cave fuzz and grows a shell you can see the light through.',
  size: 2,
  tags: ['mineral', 'crystal', 'glow'],
  art: {
    palette: { c: '#8fe9ff', d: '#3f8fa8', b: '#d7c4a8', e: '#2a2a3a' },
    frames: [
      ['..cccc..', '.cccccc.', 'cccddccc', 'bbbbbbb.', '.bbbbbbe'],
      ['..cccc..', '.cccccc.', 'cccddccc', '.bbbbbb.', 'bbbbbbbe'],
    ],
    frameMs: 340,
    faceMotion: true,
  },
  body: { mass: 1.3, bounce: 0, drag: 0.3, buoyancy: 0.5, immuneTo: [] },
  move: { kind: 'crawl', speed: 1.4, jump: 0, restlessness: 0.2 },
  diet: {
    eats: ['plant', 'fungus'],
    fears: [],
    hungerRate: 0.014,
    starveSeconds: 80,
    breedAt: 0.88,
    lifespanSeconds: 480,
  },
  senses: { sight: 14 },
  // Amphibious, like a real snail. It lives in caves and in tidepools, and the
  // tidepool is half underwater — a snail that drowns in a rockpool is a snail
  // that dies on the first tide.
  habitat: { needs: null, drowns: false },
  dig: { through: ['crystal', 'gem', 'stone'], speed: 0.6 },
  death: { becomes: 'crystal', particleColor: '#8fe9ff', particleCount: 10 },
  aura: null,
  glow: 0.4,
})

// ---------------------------------------------------------------------------
// The big ones
//
// Every one of these was authored by the model through the ordinary summon
// route and pasted in verbatim — no hand-editing. They are here because they
// prove the claim this file opens with: a creature is data, and there is no
// size at which that stops being true. The Emberwing Elder is 28x24, about
// twelve times the area of a Stalker, and the simulation needed nothing new to
// run it.
//
// Anything past 12x10 collides with its middle only (see `bodyBox`), which is
// what lets that wingspan follow a rider down a cave mouth half its width.
// ---------------------------------------------------------------------------

const DRAGON = builtin('dragon', {
  name: 'Emberwing Elder',
  blurb:
    'An ancient dragon with wings as wide as a barn, whose scales still glow with the fire inside it.',
  size: 6,
  tags: ['meat', 'dragon', 'fire', 'glow'],
  art: {
    palette: {
      a: '#180806',
      b: '#c0392b',
      c: '#9c3320',
      d: '#5e1a10',
      e: '#e8792f',
      f: '#7d1f14',
      g: '#ff8f3f',
      h: '#ffd166',
      i: '#fff3c0',
    },
    frames: [
      [
        '..aa......................',
        '.acca.....................',
        '.acdca....................',
        '.acdcca...............aa..',
        '.acdccca............aabba.',
        '.acdccdca.........aabbbba.',
        '.acdccdcca.......aabdhddha',
        '.acdccdccda.....aabbddddda',
        '.acdccdccdcaa...abbbbbbbba',
        '.aacaacaacaccaaabbbbbibbi.',
        '....aaaaaaaabbbbbbbbaaaa..',
        '.......aaaabbbbbbbbba.....',
        '..aaaaaabbbbbeeeebbba.....',
        'aaffffbbbbbeeeeeeeeaa.....',
        '.aaffbbbbbbeeeeeeeaa......',
        '..aaaffbbbbbbbbbaaa.......',
        '.....aaabbaaaabba.........',
        '........abba..abba........',
        '.......aaffa.aaffa........',
        '.......aaaa...aaaa........',
      ],
      [
        '....a.....................',
        '...aca....................',
        '..accca...................',
        '.accddca..............aa..',
        '.accdcccaa..........aabba.',
        '.acddccdcca.......aabbbba.',
        '.acdcccdccca.....aabdhddha',
        '.acdccddccdca...aabbddddda',
        '.acaacaccdcca...abbbbbbbba',
        '.aaaaaacaaaacaaabbbbbiaai.',
        '......aaaaaabbbbbbbbabaa..',
        '.......aaaabbbbbbbbba.bb..',
        '..aaaa.abbbbbeeeebbba.....',
        'aaffffbbbbbeeeeeeeeaa.....',
        '.aaffbbbbbbeeeeeeeaa......',
        '..aaaffbbbbbbbbbaaa.......',
        '.....aaabbaaaabba.........',
        '........abba..abba........',
        '.......aaffa.aaffa........',
        '.......aaaa...aaaa........',
      ],
      [
        '....a.....................',
        '...aca....................',
        '..accca...................',
        '.accddca..............aa..',
        '.accdcccaa..........aabba.',
        '.acddccdcca.......aabbbba.',
        '.acdcccdccca.....aabdhddha',
        '.acdccddccdca...aabbddddda',
        '.acaacaccdcca...abbbbbbbba',
        '.aaaaaacaaaacaaabbbbbiaai.',
        '......aaaaaabbbbbbbbabgg..',
        '.......aaaabbbbbbbbba.gg..',
        '..aaaa.abbbbbeeeebbba.....',
        'aaffffbbbbbeeeeeeeeaa.....',
        '.aaffbbbbbbeeeeeeeaa......',
        '..aaaffbbbbbbbbbaaa.......',
        '.....aaabbaaaabba.........',
        '........abba..abba........',
        '.......aaffa.aaffa........',
        '.......aaaa...aaaa........',
      ],
      [
        '....a.....................',
        '...aca....................',
        '..accca...................',
        '.accddca..............aa..',
        '.accdcccaa..........aabba.',
        '.acddccdcca.......aabbbba.',
        '.acdcccdccca.....aabdhddha',
        '.acdccddccdca...aabbddddda',
        '.acaacaccdcca...abbbbbbbba',
        '.aaaaaacaaaacaaabbbbbiaai.',
        '......aaaaaabbbbbbbbabge..',
        '.......aaaabbbbbbbbba.eb..',
        '..aaaa.abbbbbeeeebbba.eg..',
        'aaffffbbbbbeeeeeeeeaa.bgg.',
        '.aaffbbbbbbeeeeeeeaa.gggg.',
        '..aaaffbbbbbbbbbaaa.......',
        '.....aaabbaaaabba.........',
        '........abba..abba........',
        '.......aaffa.aaffa........',
        '.......aaaa...aaaa........',
      ],
    ],
    frameMs: 300,
    faceMotion: true,
  },
  body: {
    mass: 3,
    bounce: 0.05,
    drag: 0.82,
    buoyancy: 0.7,
    immuneTo: ['lava', 'ash', 'obsidian', 'stone'],
  },
  move: { kind: 'fly', speed: 4.5, jump: 0, restlessness: 0.12 },
  diet: {
    eats: ['meat'],
    fears: [],
    hungerRate: 0.014,
    starveSeconds: 110,
    breedAt: 0.85,
    lifespanSeconds: 900,
  },
  senses: { sight: 46 },
  habitat: { needs: null, drowns: true },
  dig: { through: ['ash', 'obsidian', 'stone'], speed: 0.6 },
  death: { becomes: 'ash', particleColor: '#180806', particleCount: 14 },
  aura: {
    radius: 10,
    helps: [],
    boost: 1,
    converts: { from: 'ice', to: 'water' },
    convertRate: 0.3,
  },
  glow: 0.7,
})

const TREX = builtin('trex', {
  name: 'Tyrannosaurus Rex',
  blurb: 'A huge two-legged dinosaur with tiny arms and a jaw big enough to swallow a log.',
  size: 6,
  tags: ['meat', 'dinosaur', 'beast'],
  art: {
    palette: {
      a: '#4e7a35',
      b: '#14200f',
      c: '#7aa84c',
      d: '#2c4620',
      e: '#f2f0e4',
      f: '#ffd23f',
      g: '#8e3b3b',
    },
    frames: [
      [
        '................bbbbbb..',
        '...............bccccccb.',
        '...............bcafaafab',
        '..............bacaaaaaa.',
        '..............baccccccc.',
        '............bbbaaccebbe.',
        '.........bbbbaaaaacccc..',
        '......bbbbaaaaaaabbb....',
        '.....bbaaaccccaaaaab....',
        '..bbbaaaacccccccaaaaab..',
        'bbaaaaccccccccccabbbaab.',
        '.bbbaaaccccccccaabbbb...',
        '....bbbaaaaaaaaaaabb....',
        '......baaab..baaaab.....',
        '......baab....baaab.....',
        '.....bbaab....bdaab.....',
        '....bbaaa......bdab.....',
        '...bbddaa.....bbddbb....',
      ],
      [
        '................bbbbbb..',
        '...............bccccccb.',
        '...............bcafaafab',
        '..............bacaaaaaa.',
        '..............baccccccc.',
        '............bbbaaccebbe.',
        '.........bbbbaaaaacbggb.',
        '......bbbbaaaaaaabbecce.',
        'bbbbbaaaaaccccaaaaa.....',
        '..aaaaaaacccccccaaabb...',
        '...baaccccccccccabaabb..',
        '....bbbccccccccaabbaa...',
        '.......aaaaaaaaaaabb....',
        '......baaab..baaaab.....',
        '.......aab....bbbaa.....',
        '.......aaa....b.baaa....',
        '.......aaa......bbaa....',
        '...b....ddb.......bb....',
      ],
    ],
    frameMs: 260,
    faceMotion: true,
  },
  body: { mass: 3, bounce: 0.05, drag: 0.6, buoyancy: 0.85, immuneTo: [] },
  move: { kind: 'walk', speed: 5, jump: 6, restlessness: 0.15 },
  diet: {
    eats: ['meat'],
    fears: [],
    hungerRate: 0.02,
    starveSeconds: 90,
    breedAt: 0.8,
    lifespanSeconds: 800,
  },
  senses: { sight: 40 },
  habitat: { needs: null, drowns: true },
  dig: { through: [], speed: 0.2 },
  death: { becomes: 'bone', particleColor: '#4e7a35', particleCount: 14 },
  aura: null,
  glow: 0,
})

const TOWER_FOLK = builtin('tower-folk', {
  name: 'Tall Tim Twosome',
  blurb:
    'Two friends who travel everywhere as one very tall person, with the top one keeping watch far ahead.',
  size: 5,
  tags: ['meat', 'walker'],
  art: {
    palette: {
      s: '#f0c39a',
      k: '#d69a70',
      c: '#3f6fbf',
      b: '#2b4c8c',
      r: '#c8443c',
      h: '#4a3327',
      e: '#20242c',
      y: '#ffe9a8',
    },
    frames: [
      [
        '......yyy.....',
        '.....yhhhy....',
        '.....hsssh....',
        '.....sseses...',
        '......sss.....',
        '....rrrrrrr...',
        '...r.rrrrr.r..',
        '...s.rrrrr.s..',
        '...s..rrr..s..',
        '......bbb.....',
        '.....bb.bb....',
        '.....k....k...',
        '.....k....k...',
        '......hhh.....',
        '.....hhhhh....',
        '.....hsssh....',
        '......sses....',
        '....ccccccc...',
        '...c.ccccc.c..',
        '...s.ccccc.s..',
        '...s..ccc..s..',
        '......bbb.....',
        '.....bb.bb....',
        '....kk....kk..',
      ],
      [
        '......yyy.....',
        '.....yhhhy....',
        '.....hsssh....',
        '.....sse.es...',
        '......sss.....',
        '....rrrrrrr...',
        '..sr.rrrrr.rs.',
        '...s.rrrrr.s..',
        '......rrr.....',
        '......bbb.....',
        '.....bb.bb....',
        '.....k....k...',
        '.....k....k...',
        '......hhh.....',
        '.....hhhhh....',
        '.....hsssh....',
        '......sses....',
        '....ccccccc...',
        '..sc.ccccc.cs.',
        '...s.ccccc.s..',
        '......ccc.....',
        '......bbb.....',
        '.....bb.bb....',
        '...kk......kk.',
      ],
    ],
    frameMs: 220,
    faceMotion: true,
  },
  body: { mass: 1.6, bounce: 0.05, drag: 0.75, buoyancy: 0.9, immuneTo: [] },
  move: { kind: 'walk', speed: 3.5, jump: 5, restlessness: 0.25 },
  diet: {
    eats: ['plant', 'meat'],
    fears: [],
    hungerRate: 0.03,
    starveSeconds: 50,
    breedAt: 0.78,
    lifespanSeconds: 420,
  },
  senses: { sight: 34 },
  habitat: { needs: null, drowns: true },
  dig: { through: [], speed: 0.2 },
  death: { becomes: null, particleColor: '#c8443c', particleCount: 10 },
  aura: null,
  glow: 0,
})

const UNICYCLE_CLOWN = builtin('unicycle-clown', {
  name: 'Wobble Clown',
  blurb:
    'A cheerful circus clown who balances on a squeaky one-wheeled cycle and never quite stops wobbling.',
  size: 4,
  tags: ['meat', 'clown', 'rider'],
  art: {
    palette: {
      r: '#e83b3b',
      w: '#fff4f0',
      y: '#ffd23f',
      b: '#3b6ee8',
      s: '#f6c6a8',
      k: '#2a2438',
      g: '#8a8fa8',
      o: '#ff8a3d',
    },
    frames: [
      [
        '......rrr.......',
        '....rrrrrrr.....',
        '.....rwwwwr.....',
        '....rwsssswr....',
        '....ws.k.k.sw...',
        '....ws..r..sw...',
        '....ws.www.sw...',
        '.....wsssssw....',
        '......bbbbb.....',
        '....yybbbbbyy...',
        '...y.bbbbbbb.y..',
        '......bbbbb.....',
        '.....b.....b....',
        '....k.......k...',
        '......kkk.......',
        '.....k.g.k......',
        '....k..g..k.....',
        '....k.ggg..k....',
        '....k..g...k....',
        '.....k...k......',
        '......kkk.......',
      ],
      [
        '......rrr.......',
        '....rrrrrrr.....',
        '.....rwwwwr.....',
        '....rwsssswr....',
        '....ws.-.-.sw...',
        '....ws..r..sw...',
        '....ws.www.sw...',
        '.....wsssssw....',
        '......bbbbb.....',
        '...yybbbbbbyy...',
        '..y..bbbbbbb..y.',
        '......bbbbb.....',
        '.....b.....b....',
        '......k...k.....',
        '......kkk.......',
        '.....k...k......',
        '....k..g..k.....',
        '....k.ggg..k....',
        '....k..g..k.....',
        '.....k.g.k......',
        '......kkk.......',
      ],
    ],
    frameMs: 150,
    faceMotion: true,
  },
  body: { mass: 1, bounce: 0.35, drag: 0.82, buoyancy: 0.95, immuneTo: [] },
  // Hopping on one wheel, because a clown on a unicycle that simply walked
  // about would be the least funny thing in the world.
  move: { kind: 'walk', speed: 6, jump: 7, hop: 0.55, restlessness: 0.6 },
  diet: {
    eats: ['plant'],
    fears: [],
    hungerRate: 0.03,
    starveSeconds: 40,
    breedAt: 0.75,
    lifespanSeconds: 300,
  },
  senses: { sight: 18 },
  habitat: { needs: null, drowns: true },
  dig: { through: [], speed: 0.2 },
  death: { becomes: null, particleColor: '#ffd23f', particleCount: 16 },
  aura: null,
  glow: 0,
})

export const BUILTIN_CREATURES: CreatureBlueprint[] = [
  SUNLEAF,
  BRAMBLE,
  KELP,
  SPORECAP,
  FROSTCAP,
  GLOWVINE,
  SKYBLOOM,
  MITE,
  HOPPER,
  GLIMMER_MOTH,
  FINLING,
  EMBER_GRUB,
  DELVER,
  MOTE,
  PALECRAWLER,
  DRIFTMOLE,
  WOOLLY,
  DUSTBEE,
  LOAMWORM,
  CRYSTAL_SNAIL,
  STALKER,
  DRIFTER_JELLY,
  GULPER,
  CINDER_WYRM,
  RUSTBOT,
  UNICYCLE_CLOWN,
  TOWER_FOLK,
  RIMECLAW,
  SUNHAWK,
  GLOOMWEAVER,
  WISP,
  GRUMBLESTONE,
  TREX,
  DRAGON,
]

export const BUILTIN_BY_ID: Record<string, CreatureBlueprint> = Object.fromEntries(
  BUILTIN_CREATURES.map(c => [c.id, c])
)
