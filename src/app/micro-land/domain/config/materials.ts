/**
 * The stuff the world is made of.
 *
 * Order matters: the index into MATERIAL_IDS is what's stored in the tile grid,
 * so `air` must stay at 0 (a zeroed Uint8Array is an empty world). Appending is
 * safe; reordering is not.
 */
import type { Material, MaterialId } from '@/app/micro-land/domain/types'

export const MATERIAL_IDS = [
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
] as const

export const MATERIALS: Record<MaterialId, Material> = {
  air: {
    id: 'air',
    name: 'Air',
    color: '#000000',
    grain: 0,
    solid: false,
    liquid: false,
    powder: false,
    deadly: false,
    glow: 0,
    fertile: false,
  },
  dirt: {
    id: 'dirt',
    name: 'Dirt',
    color: '#6b4a2f',
    grain: 0.16,
    solid: true,
    liquid: false,
    powder: false,
    deadly: false,
    glow: 0,
    fertile: true,
  },
  grass: {
    id: 'grass',
    name: 'Grass',
    color: '#4f9d3a',
    grain: 0.18,
    solid: true,
    liquid: false,
    powder: false,
    deadly: false,
    glow: 0,
    fertile: true,
  },
  stone: {
    id: 'stone',
    name: 'Stone',
    color: '#5c6470',
    grain: 0.14,
    solid: true,
    liquid: false,
    powder: false,
    deadly: false,
    glow: 0,
    fertile: false,
  },
  sand: {
    id: 'sand',
    name: 'Sand',
    color: '#d9c08a',
    grain: 0.12,
    solid: true,
    liquid: false,
    powder: true,
    deadly: false,
    glow: 0,
    fertile: true,
  },
  water: {
    id: 'water',
    name: 'Water',
    color: '#2f7fd4',
    grain: 0.1,
    solid: false,
    liquid: true,
    powder: false,
    deadly: false,
    glow: 0.05,
    fertile: false,
  },
  lava: {
    id: 'lava',
    name: 'Lava',
    color: '#e2551d',
    grain: 0.2,
    solid: false,
    liquid: true,
    powder: false,
    deadly: true,
    glow: 1,
    fertile: false,
  },
  ice: {
    id: 'ice',
    name: 'Ice',
    color: '#a8d8ea',
    grain: 0.1,
    solid: true,
    liquid: false,
    powder: false,
    deadly: false,
    glow: 0.1,
    fertile: false,
  },
  metal: {
    id: 'metal',
    name: 'Metal',
    color: '#8a93a3',
    grain: 0.08,
    solid: true,
    liquid: false,
    powder: false,
    deadly: false,
    glow: 0,
    fertile: false,
  },
  glass: {
    id: 'glass',
    name: 'Glass',
    color: '#9fd4d8',
    grain: 0.06,
    solid: true,
    liquid: false,
    powder: false,
    deadly: false,
    glow: 0.15,
    fertile: false,
  },
  ash: {
    id: 'ash',
    name: 'Ash',
    color: '#4a4550',
    grain: 0.18,
    solid: true,
    liquid: false,
    powder: true,
    deadly: false,
    glow: 0,
    fertile: true,
  },
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian',
    color: '#241f2e',
    grain: 0.12,
    solid: true,
    liquid: false,
    powder: false,
    deadly: false,
    glow: 0,
    fertile: false,
  },
  wood: {
    id: 'wood',
    name: 'Wood',
    color: '#7a5230',
    grain: 0.14,
    solid: true,
    liquid: false,
    powder: false,
    deadly: false,
    glow: 0,
    fertile: true,
  },
}

/** Numeric index of each material, for the tile grid. */
export const MATERIAL_INDEX: Record<MaterialId, number> = MATERIAL_IDS.reduce(
  (acc, id, i) => {
    acc[id] = i
    return acc
  },
  {} as Record<MaterialId, number>
)

export const MATERIAL_BY_INDEX: Material[] = MATERIAL_IDS.map((id) => MATERIALS[id])

export const AIR = MATERIAL_INDEX.air

/** Materials the player can paint with, in palette order. */
export const PAINTABLE: MaterialId[] = [
  'dirt',
  'grass',
  'stone',
  'sand',
  'water',
  'lava',
  'ice',
  'wood',
  'metal',
  'glass',
  'obsidian',
]

/** Precomputed flags, indexed the same way as the tile grid (hot path). */
export const IS_SOLID: Uint8Array = new Uint8Array(
  MATERIAL_BY_INDEX.map((m) => (m.solid ? 1 : 0))
)
export const IS_LIQUID: Uint8Array = new Uint8Array(
  MATERIAL_BY_INDEX.map((m) => (m.liquid ? 1 : 0))
)
export const IS_POWDER: Uint8Array = new Uint8Array(
  MATERIAL_BY_INDEX.map((m) => (m.powder ? 1 : 0))
)
export const IS_DEADLY: Uint8Array = new Uint8Array(
  MATERIAL_BY_INDEX.map((m) => (m.deadly ? 1 : 0))
)
export const IS_FERTILE: Uint8Array = new Uint8Array(
  MATERIAL_BY_INDEX.map((m) => (m.fertile ? 1 : 0))
)
