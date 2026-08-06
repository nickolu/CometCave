import type { MaterialId } from '../types'

export interface BiomeEntry {
  material: MaterialId
  weight: number
}

export interface Biome {
  id: string
  label: string
  /** Representative CSS color for the toolbar swatch. */
  color: string
  /** Each painted tile picks a material by weighted random selection. */
  palette: BiomeEntry[]
}

export const BIOMES: Biome[] = [
  {
    id: 'forest',
    label: 'Forest',
    color: '#4a7c59',
    palette: [
      { material: 'grass', weight: 4 },
      { material: 'dirt', weight: 3 },
      { material: 'wood', weight: 2 },
      { material: 'moss', weight: 1 },
    ],
  },
  {
    id: 'desert',
    label: 'Desert',
    color: '#c8a84b',
    palette: [
      { material: 'sand', weight: 8 },
      { material: 'stone', weight: 2 },
      { material: 'glass', weight: 1 },
    ],
  },
  {
    id: 'wetland',
    label: 'Wetland',
    color: '#2d6a8f',
    palette: [
      { material: 'mud', weight: 5 },
      { material: 'water', weight: 3 },
      { material: 'grass', weight: 2 },
    ],
  },
  {
    id: 'savanna',
    label: 'Savanna',
    color: '#8ab86b',
    palette: [
      { material: 'grass', weight: 6 },
      { material: 'sand', weight: 2 },
      { material: 'stone', weight: 1 },
    ],
  },
]

export const BIOME_BY_ID: Record<string, Biome> = Object.fromEntries(
  BIOMES.map(b => [b.id, b])
)
