/**
 * Filtering the creature roster by what a creature *is*.
 *
 * The roster outgrew the six group tabs a while ago — thirty-odd built-ins plus
 * however many the player has summoned — and the tabs answer "what does it do
 * for a living", which is the wrong question when you are looking for something
 * that flies, or something lava can't touch. This adds the other axes.
 *
 * Every predicate reads the blueprint, so a creature invented thirty seconds ago
 * files itself correctly with no list in the UI to keep up to date. That is the
 * same reason `creatureGroup` derives its answer rather than looking it up.
 */
import { MOVE_WORDS } from './blueprint'

import type { CreatureBlueprint, LocomotionKind } from './types'

/**
 * Size, in the three bands a person actually thinks in.
 *
 * The schema's 1..6 is a food-chain number, not a word — "is it bigger than me"
 * is all the simulation ever asks of it. Six chips of bare digits would make the
 * player do that translation themselves, so the bands carry the meaning instead.
 * The split is where the roster naturally clusters: 1-2 is everything bug-sized,
 * 5-6 is the handful of things that read as landmarks.
 */
export type SizeBandId = 'tiny' | 'medium' | 'huge'

export const SIZE_BANDS: { id: SizeBandId; label: string; min: number; max: number }[] = [
  { id: 'tiny', label: 'Tiny', min: 1, max: 2 },
  { id: 'medium', label: 'Medium', min: 3, max: 4 },
  { id: 'huge', label: 'Huge', min: 5, max: 6 },
]

/** Locomotion chips, in the order they appear. Ground first, then off it. */
export const MOVE_ORDER: LocomotionKind[] = ['walk', 'crawl', 'fly', 'drift', 'swim', 'root']

/**
 * A filter is empty until the player narrows it.
 *
 * Each axis is ANDed with the others; within an axis the choices are ORed, so
 * "flies or swims, and huge" is expressible and "flies and swims" — which no
 * creature can ever satisfy, since `move.kind` is a single value — is not.
 * An empty list on an axis means that axis isn't asking anything.
 */
export interface CreatureFilter {
  moves: LocomotionKind[]
  sizes: SizeBandId[]
  /** Keep only creatures that cast their own light. */
  glows: boolean
  /** Keep only creatures lava can't hurt. */
  lavaProof: boolean
  /** Keep only creatures with at least one of these structural diet tags. */
  dietTags: string[]
}

export const EMPTY_FILTER: CreatureFilter = {
  moves: [],
  sizes: [],
  glows: false,
  lavaProof: false,
  dietTags: [],
}

/** True if a creature casts light of its own. */
export function isGlowing(bp: CreatureBlueprint): boolean {
  return bp.glow > 0
}

/**
 * True if lava can't hurt this creature.
 *
 * Asks for lava by name rather than trusting a non-empty `immuneTo` the way the
 * inspector's "fireproof" line does. Immunity is a list of materials and the
 * roster already has a creature immune to four of them; a filter that answered
 * "lava-proof: yes" for something merely immune to acid would be a lie the
 * player only finds out about by dropping it in a lava fall.
 */
export function isLavaProof(bp: CreatureBlueprint): boolean {
  return bp.body.immuneTo.includes('lava')
}

/** Which size band a creature falls in, or null if it somehow lands outside them. */
export function sizeBand(bp: CreatureBlueprint): SizeBandId | null {
  return SIZE_BANDS.find(b => bp.size >= b.min && bp.size <= b.max)?.id ?? null
}

/** True if any axis is asking something. */
export function isFilterActive(filter: CreatureFilter): boolean {
  return (
    filter.moves.length > 0 ||
    filter.sizes.length > 0 ||
    filter.glows ||
    filter.lavaProof ||
    filter.dietTags.length > 0
  )
}

/** How many conditions are on — the number badged on the collapsed control. */
export function activeConditionCount(filter: CreatureFilter): number {
  return (
    filter.moves.length +
    filter.sizes.length +
    (filter.glows ? 1 : 0) +
    (filter.lavaProof ? 1 : 0) +
    filter.dietTags.length
  )
}

export function matchesFilter(bp: CreatureBlueprint, filter: CreatureFilter): boolean {
  if (filter.moves.length > 0 && !filter.moves.includes(bp.move.kind)) return false
  if (filter.sizes.length > 0) {
    const band = sizeBand(bp)
    if (!band || !filter.sizes.includes(band)) return false
  }
  if (filter.glows && !isGlowing(bp)) return false
  if (filter.lavaProof && !isLavaProof(bp)) return false
  if (filter.dietTags.length > 0 && !filter.dietTags.some(tag => bp.tags.includes(tag))) return false
  return true
}

/**
 * Which chips are worth showing at all, read off the roster.
 *
 * A world with nothing that swims has no business offering a Swims chip whose
 * only possible outcome is an empty panel. Computed against the *whole* roster
 * rather than the currently-filtered one on purpose: chips that appeared and
 * vanished as you toggled the ones beside them would move the row under a thumb
 * mid-tap, which on a phone is how you end up filtering by something you never
 * meant to pick.
 */
export interface FilterOptions {
  moves: LocomotionKind[]
  sizes: SizeBandId[]
  glows: boolean
  lavaProof: boolean
  dietTags: string[]
}

const DIET_TAG_ORDER = ['plant', 'meat', 'mineral'] as const

export function filterOptions(roster: CreatureBlueprint[]): FilterOptions {
  const moves = new Set<LocomotionKind>()
  const sizes = new Set<SizeBandId>()
  let glows = false
  let lavaProof = false
  const dietTagSet = new Set<string>()
  for (const bp of roster) {
    moves.add(bp.move.kind)
    const band = sizeBand(bp)
    if (band) sizes.add(band)
    if (isGlowing(bp)) glows = true
    if (isLavaProof(bp)) lavaProof = true
    for (const tag of bp.tags) {
      if (DIET_TAG_ORDER.includes(tag as (typeof DIET_TAG_ORDER)[number])) {
        dietTagSet.add(tag)
      }
    }
  }
  return {
    moves: MOVE_ORDER.filter(k => moves.has(k)),
    sizes: SIZE_BANDS.filter(b => sizes.has(b.id)).map(b => b.id),
    glows,
    lavaProof,
    dietTags: DIET_TAG_ORDER.filter(t => dietTagSet.has(t)),
  }
}

/**
 * The filter said as a sentence, for the collapsed summary and the empty state.
 *
 * Reads as a list of things the player asked for rather than a query, because
 * the one time it is most needed is when it has emptied the panel and the
 * question in the player's head is "what did I ask for?".
 */
export function describeFilter(filter: CreatureFilter): string {
  const parts: string[] = []
  if (filter.moves.length > 0) parts.push(filter.moves.map(k => MOVE_WORDS[k]).join(' or '))
  if (filter.sizes.length > 0) {
    const names = SIZE_BANDS.filter(b => filter.sizes.includes(b.id)).map(b =>
      b.label.toLowerCase()
    )
    parts.push(names.join(' or '))
  }
  if (filter.glows) parts.push('glows in the dark')
  if (filter.lavaProof) parts.push('lava-proof')
  if (filter.dietTags.length > 0) parts.push(filter.dietTags.join(' or '))
  return parts.join(' · ')
}
