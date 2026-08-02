/**
 * The stuff the world is made of.
 *
 * Order matters: the index into MATERIAL_IDS is what's stored in the tile grid,
 * so `air` must stay at 0 (a zeroed Uint8Array is an empty world). Appending is
 * safe; reordering is not. Tint variants are generated *after* the base list for
 * exactly that reason — adding a new color can never shift an existing index.
 *
 * Every material is written as a short override of `DEFAULTS`, so each entry
 * says only what makes it different from plain rock.
 */
import type {
  BaseMaterialId,
  Material,
  MaterialId,
  TintId,
  TintableMaterialId,
} from '@/app/micro-land/domain/types'

/** Boring rock. Every material below is a diff against this. */
const DEFAULTS: Omit<Material, 'id' | 'name' | 'color'> = {
  grain: 0.14,
  solid: true,
  liquid: false,
  powder: false,
  deadly: false,
  glow: 0,
  fertile: false,
  viscous: 0,
  breathable: false,
  melts: false,
  corrosive: false,
  acidProof: false,
  tintable: false,
  tintOf: null,
}

function material(
  id: MaterialId,
  name: string,
  color: string,
  overrides: Partial<Material> = {}
): Material {
  return { ...DEFAULTS, id, name, color, ...overrides }
}

/**
 * The vocabulary — the materials a person names.
 *
 * This is also the list handed to the summoning model, which is why the tints
 * are kept out of it: "plastic" is a thing you can ask for, "plastic-mauve" is a
 * thing you point at in the paint box.
 */
export const BASE_MATERIAL_IDS = [
  'air',
  'dirt',
  'grass',
  'stone',
  'sand',
  'water',
  'lava',
  'ice',
  'metal',
  'glass',
  'ash',
  'obsidian',
  'wood',
  'snow',
  'mud',
  'moss',
  'crystal',
  'gem',
  'gold',
  'bone',
  'iron',
  'marble',
  'plastic',
  'cloud',
  'sap',
  'acid',
] as const satisfies readonly BaseMaterialId[]

const BASE_MATERIALS: Record<BaseMaterialId, Material> = {
  air: material('air', 'Air', '#000000', { grain: 0, solid: false }),
  dirt: material('dirt', 'Dirt', '#6b4a2f', { grain: 0.16, fertile: true }),
  grass: material('grass', 'Grass', '#4f9d3a', { grain: 0.18, fertile: true }),
  stone: material('stone', 'Stone', '#5c6470'),
  sand: material('sand', 'Sand', '#d9c08a', { grain: 0.12, powder: true, fertile: true }),
  water: material('water', 'Water', '#2f7fd4', {
    grain: 0.1,
    solid: false,
    liquid: true,
    glow: 0.05,
  }),
  lava: material('lava', 'Lava', '#e2551d', {
    grain: 0.2,
    solid: false,
    liquid: true,
    deadly: true,
    glow: 1,
    acidProof: true,
  }),
  ice: material('ice', 'Ice', '#a8d8ea', { grain: 0.1, glow: 0.1, melts: true }),
  metal: material('metal', 'Metal', '#8a93a3', { grain: 0.08 }),
  glass: material('glass', 'Glass', '#9fd4d8', { grain: 0.06, glow: 0.15, acidProof: true }),
  ash: material('ash', 'Ash', '#4a4550', { grain: 0.18, powder: true, fertile: true }),
  obsidian: material('obsidian', 'Obsidian', '#241f2e', { grain: 0.12, acidProof: true }),
  wood: material('wood', 'Wood', '#7a5230', { fertile: true }),

  // --- cold ---------------------------------------------------------------
  // Snow is fertile on purpose: a snowfield made only of snow would have
  // nowhere for a frostcap to root, and a cold world where nothing grows is a
  // cold world where nothing lives.
  snow: material('snow', 'Snow', '#eaf2fb', {
    grain: 0.07,
    powder: true,
    fertile: true,
    glow: 0.08,
    melts: true,
  }),
  mud: material('mud', 'Mud', '#4d3a26', { grain: 0.22, powder: true, fertile: true }),
  moss: material('moss', 'Moss', '#5f8a3e', { grain: 0.24, fertile: true, glow: 0.04 }),

  // --- shiny --------------------------------------------------------------
  crystal: material('crystal', 'Crystal', '#8fe9ff', {
    grain: 0.09,
    glow: 0.5,
    acidProof: true,
    tintable: true,
  }),
  gem: material('gem', 'Gem', '#ff6fa8', {
    grain: 0.07,
    glow: 0.32,
    acidProof: true,
    tintable: true,
  }),
  gold: material('gold', 'Gold', '#e8b73a', { grain: 0.1, glow: 0.12, acidProof: true }),
  bone: material('bone', 'Bone', '#e4ddc6', { grain: 0.15, fertile: true }),

  // --- built --------------------------------------------------------------
  iron: material('iron', 'Iron', '#6e5648', { grain: 0.17 }),
  marble: material('marble', 'Marble', '#e6e8ef', { grain: 0.05, acidProof: true }),
  plastic: material('plastic', 'Plastic', '#d8dce4', {
    grain: 0.03,
    acidProof: true,
    tintable: true,
  }),

  // --- soft and mean ------------------------------------------------------
  // Cloud is the odd one out: not solid, so you fall through it, but thick
  // enough that you fall *slowly*. It doesn't flow, so it stays where painted.
  cloud: material('cloud', 'Cloud', '#f2f6ff', {
    grain: 0.05,
    solid: false,
    glow: 0.18,
    viscous: 0.78,
    tintable: true,
  }),
  sap: material('sap', 'Sap', '#c98a1e', {
    grain: 0.13,
    solid: false,
    liquid: true,
    breathable: true,
    viscous: 0.92,
    glow: 0.06,
  }),
  acid: material('acid', 'Acid', '#8ee02a', {
    grain: 0.16,
    solid: false,
    liquid: true,
    deadly: true,
    corrosive: true,
    glow: 0.4,
    acidProof: true,
  }),
}

// ---------------------------------------------------------------------------
// Tints
// ---------------------------------------------------------------------------

export interface Tint {
  id: TintId
  name: string
  color: string
}

export const TINTS: Tint[] = [
  { id: 'red', name: 'Red', color: '#e0483f' },
  { id: 'orange', name: 'Orange', color: '#ef8c3a' },
  { id: 'yellow', name: 'Yellow', color: '#f2d04b' },
  { id: 'green', name: 'Green', color: '#4fb861' },
  { id: 'blue', name: 'Blue', color: '#3f86e0' },
  { id: 'purple', name: 'Purple', color: '#9b5fd0' },
  { id: 'pink', name: 'Pink', color: '#ef79b0' },
  { id: 'white', name: 'White', color: '#eef1f6' },
  { id: 'black', name: 'Black', color: '#2a2b34' },
]

const TINTABLE: TintableMaterialId[] = ['plastic', 'crystal', 'gem', 'cloud']

/** `'plastic' + 'red'` → `'plastic-red'`, in one place so nothing hand-builds it. */
export function tintedId(base: TintableMaterialId, tint: TintId): MaterialId {
  return `${base}-${tint}`
}

const TINT_MATERIALS: Material[] = TINTABLE.flatMap(base =>
  TINTS.map(tint => {
    const source = BASE_MATERIALS[base]
    const id = tintedId(base, tint.id)
    return {
      ...source,
      id,
      name: `${tint.name} ${source.name}`,
      // A tinted crystal should still read as crystal, so the tint is pulled
      // part-way toward the material's own color rather than replacing it.
      color: mix(tint.color, source.color, base === 'plastic' ? 0.1 : 0.34),
      tintable: false,
      tintOf: base,
    }
  })
)

/** Blend two hex colors. `t` is how much of `b` to take. */
function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const out = [16, 8, 0].map(shift => {
    const ca = (pa >> shift) & 255
    const cb = (pb >> shift) & 255
    return Math.round(ca + (cb - ca) * t)
  })
  return `#${out.map(c => c.toString(16).padStart(2, '0')).join('')}`
}

// ---------------------------------------------------------------------------

/** Every material in the world, base colors first, then every tint. */
export const MATERIAL_IDS: MaterialId[] = [...BASE_MATERIAL_IDS, ...TINT_MATERIALS.map(m => m.id)]

export const MATERIALS: Record<MaterialId, Material> = {
  ...BASE_MATERIALS,
  ...Object.fromEntries(TINT_MATERIALS.map(m => [m.id, m])),
} as Record<MaterialId, Material>

/** Numeric index of each material, for the tile grid. */
export const MATERIAL_INDEX: Record<MaterialId, number> = MATERIAL_IDS.reduce(
  (acc, id, i) => {
    acc[id] = i
    return acc
  },
  {} as Record<MaterialId, number>
)

export const MATERIAL_BY_INDEX: Material[] = MATERIAL_IDS.map(id => MATERIALS[id])

export const AIR = MATERIAL_INDEX.air

/**
 * Materials the player can paint with, in palette order.
 *
 * Only the base of each tintable family appears here — the colors hang off it
 * in the toolbar's tint strip instead of turning one palette into fifty.
 */
export const PAINTABLE: BaseMaterialId[] = [
  'dirt',
  'grass',
  'moss',
  'mud',
  'stone',
  'sand',
  'snow',
  'water',
  'lava',
  'acid',
  'sap',
  'ice',
  'cloud',
  'wood',
  'bone',
  'metal',
  'iron',
  'marble',
  'glass',
  'plastic',
  'obsidian',
  'crystal',
  'gem',
  'gold',
]

/** Precomputed flags, indexed the same way as the tile grid (hot path). */
export const IS_SOLID: Uint8Array = new Uint8Array(MATERIAL_BY_INDEX.map(m => (m.solid ? 1 : 0)))
export const IS_LIQUID: Uint8Array = new Uint8Array(MATERIAL_BY_INDEX.map(m => (m.liquid ? 1 : 0)))
export const IS_POWDER: Uint8Array = new Uint8Array(MATERIAL_BY_INDEX.map(m => (m.powder ? 1 : 0)))
export const IS_DEADLY: Uint8Array = new Uint8Array(MATERIAL_BY_INDEX.map(m => (m.deadly ? 1 : 0)))
export const IS_FERTILE: Uint8Array = new Uint8Array(
  MATERIAL_BY_INDEX.map(m => (m.fertile ? 1 : 0))
)
/** Liquids you can actually drown in — sap is thick, but you can breathe in it. */
export const IS_DROWNING: Uint8Array = new Uint8Array(
  MATERIAL_BY_INDEX.map(m => (m.liquid && !m.breathable ? 1 : 0))
)
export const IS_ACID_PROOF: Uint8Array = new Uint8Array(
  MATERIAL_BY_INDEX.map(m => (m.acidProof ? 1 : 0))
)
/** How much each material slows things moving through it, 0..255. */
export const VISCOSITY: Uint8Array = new Uint8Array(
  MATERIAL_BY_INDEX.map(m => Math.round(m.viscous * 255))
)
