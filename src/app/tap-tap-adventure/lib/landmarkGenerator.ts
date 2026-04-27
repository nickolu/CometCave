import { getTemplatesForRegion, getSecretTemplatesForRegion, LandmarkTemplate, LandmarkType } from '../config/landmarks'
import { euclidean } from './movementUtils'

export interface GeneratedLandmark {
  templateId: string
  name: string
  type: LandmarkType
  description: string
  icon: string
  hasShop: boolean
  encounterPrompt: string
  distanceFromEntry: number
  hidden: boolean
  isSecret: boolean
  explored: boolean
  position: { x: number; y: number }
  hasInn?: boolean
  hasStable?: boolean
  hasMailbox?: boolean
  hasNoticeBoard?: boolean
  hasTransport?: boolean
  hasCrafting?: boolean
}

// Simple string hash for seeded random
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

// Linear congruential generator seeded from a string
export function seededRandom(seed: string): () => number {
  let state = hashString(seed)
  return () => {
    // LCG parameters from Numerical Recipes
    state = (state * 1664525 + 1013904223) & 0xffffffff
    return (state >>> 0) / 0xffffffff
  }
}

// Fisher-Yates shuffle using seeded RNG
function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * Generate a deterministic set of landmarks for a region visit.
 *
 * Seed includes visitCount so each revisit of a region produces different landmarks.
 * visitCount should be computed as the number of times the character has been to
 * this region:
 *   (character.visitedRegions ?? []).filter(id => id === regionId).length
 */
export function generateLandmarks(
  regionId: string,
  characterId: string,
  visitCount: number = 0,
  difficultyMultiplier: number = 1,
  regionSize: number = 100
): GeneratedLandmark[] {
  const templates = getTemplatesForRegion(regionId)
  const seed = `${regionId}-${characterId}-${visitCount}`
  const rng = seededRandom(seed)

  // Pick 3 landmarks, always including at least 1 town if available
  const towns = templates.filter(t => t.type === 'town')
  const nonTowns = templates.filter(t => t.type !== 'town')
  let selected: LandmarkTemplate[]
  if (towns.length > 0) {
    const shuffledTowns = seededShuffle([...towns], rng)
    const shuffledNonTowns = seededShuffle([...nonTowns], rng)
    selected = [shuffledTowns[0], ...shuffledNonTowns.slice(0, 2)] as LandmarkTemplate[]
  } else {
    selected = seededShuffle([...templates], rng).slice(0, 3) as LandmarkTemplate[]
  }

  // Scale positions within the region size (margin = 10% of size)
  const margin = regionSize * 0.1
  const range = regionSize - 2 * margin

  // Assign distances: first at 20-40 steps, subsequent 25-50 steps apart (scaled by difficulty)
  let currentDist = Math.floor((20 + Math.floor(rng() * 21)) * difficultyMultiplier) // 20-40, scaled
  const landmarks: GeneratedLandmark[] = []

  for (const template of selected) {
    const position = {
      x: Math.round(margin + rng() * range),
      y: Math.round(margin + rng() * range),
    }
    landmarks.push({
      templateId: template.id,
      name: template.name,
      type: template.type,
      description: template.description,
      icon: template.icon,
      hasShop: template.hasShop,
      encounterPrompt: template.encounterPrompt,
      distanceFromEntry: currentDist,
      hidden: false,
      isSecret: false,
      explored: false,
      position,
      hasInn: template.hasInn,
      hasStable: template.hasStable,
      hasMailbox: template.hasMailbox,
      hasNoticeBoard: template.hasNoticeBoard,
      hasTransport: template.hasTransport,
      hasCrafting: template.hasCrafting,
    })
    currentDist += Math.floor((25 + Math.floor(rng() * 26)) * difficultyMultiplier) // 25-50, scaled
  }

  // Add 1 secret landmark per region (hidden until revealed)
  const secretTemplates = getSecretTemplatesForRegion(regionId)
  if (secretTemplates.length > 0) {
    const secretTemplate = secretTemplates[Math.floor(rng() * secretTemplates.length)]
    const secretDist = landmarks.length > 1
      ? Math.floor((landmarks[0].distanceFromEntry + landmarks[landmarks.length - 1].distanceFromEntry) / 2) + Math.floor(rng() * 15)
      : 30 + Math.floor(rng() * 20)
    const secretPosition = {
      x: Math.round(margin + rng() * range),
      y: Math.round(margin + rng() * range),
    }
    landmarks.push({
      templateId: secretTemplate.id,
      name: secretTemplate.name,
      type: secretTemplate.type,
      description: secretTemplate.description,
      icon: secretTemplate.icon,
      hasShop: secretTemplate.hasShop,
      encounterPrompt: secretTemplate.encounterPrompt,
      distanceFromEntry: secretDist,
      hidden: true,
      isSecret: true,
      explored: false,
      position: secretPosition,
      hasInn: secretTemplate.hasInn,
      hasStable: secretTemplate.hasStable,
      hasMailbox: secretTemplate.hasMailbox,
      hasNoticeBoard: secretTemplate.hasNoticeBoard,
      hasTransport: secretTemplate.hasTransport,
      hasCrafting: secretTemplate.hasCrafting,
    })
    landmarks.sort((a, b) => a.distanceFromEntry - b.distanceFromEntry)
  }

  return landmarks
}

/**
 * Generate a single new landmark for the current region when a map item is used.
 * Avoids duplicating templates already present in the landmark list.
 */
export function generateMapLandmark(
  regionId: string,
  existingLandmarks: GeneratedLandmark[],
  regionBounds: { width: number; height: number },
): GeneratedLandmark | null {
  const templates = getTemplatesForRegion(regionId)
  const secretTemplates = getSecretTemplatesForRegion(regionId)
  const allTemplates = [...templates, ...secretTemplates]

  // Filter out templates already used
  const existingIds = new Set(existingLandmarks.map(lm => lm.templateId))
  const available = allTemplates.filter(t => !existingIds.has(t.id))

  if (available.length === 0) return null

  // Use timestamp-based seed for non-deterministic generation (each map use is unique)
  const rng = seededRandom(`map-${regionId}-${Date.now()}`)
  const template = available[Math.floor(rng() * available.length)]

  const margin = regionBounds.width * 0.1
  const rangeX = regionBounds.width - 2 * margin
  const rangeY = regionBounds.height - 2 * margin

  // Place landmark at a distance between existing ones
  const maxDist = existingLandmarks.length > 0
    ? Math.max(...existingLandmarks.map(lm => lm.distanceFromEntry))
    : 50
  const distanceFromEntry = Math.floor(maxDist * 0.3 + rng() * maxDist * 0.6)

  return {
    templateId: template.id,
    name: template.name,
    type: template.type,
    description: template.description,
    icon: template.icon,
    hasShop: template.hasShop,
    encounterPrompt: template.encounterPrompt,
    distanceFromEntry,
    hidden: false,
    isSecret: template.isSecret ?? false,
    explored: false,
    position: {
      x: Math.round(margin + rng() * rangeX),
      y: Math.round(margin + rng() * rangeY),
    },
    hasInn: template.hasInn,
    hasStable: template.hasStable,
    hasMailbox: template.hasMailbox,
    hasNoticeBoard: template.hasNoticeBoard,
    hasTransport: template.hasTransport,
    hasCrafting: template.hasCrafting,
  }
}
