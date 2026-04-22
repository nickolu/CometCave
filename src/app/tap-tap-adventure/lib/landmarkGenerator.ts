import { getTemplatesForRegion, LandmarkTemplate, LandmarkType } from '../config/landmarks'

export interface GeneratedLandmark {
  templateId: string
  name: string
  type: LandmarkType
  description: string
  icon: string
  hasShop: boolean
  encounterPrompt: string
  distanceFromEntry: number
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
  visitCount: number = 0
): GeneratedLandmark[] {
  const templates = getTemplatesForRegion(regionId)
  const seed = `${regionId}-${characterId}-${visitCount}`
  const rng = seededRandom(seed)

  // Pick 3 landmarks from templates (shuffled deterministically)
  const selected = seededShuffle([...templates], rng).slice(0, 3) as LandmarkTemplate[]

  // Assign distances: first at 20-40 steps, subsequent 25-50 steps apart
  let currentDist = 20 + Math.floor(rng() * 21) // 20-40
  const landmarks: GeneratedLandmark[] = []

  for (const template of selected) {
    landmarks.push({
      templateId: template.id,
      name: template.name,
      type: template.type,
      description: template.description,
      icon: template.icon,
      hasShop: template.hasShop,
      encounterPrompt: template.encounterPrompt,
      distanceFromEntry: currentDist,
    })
    currentDist += 25 + Math.floor(rng() * 26) // 25-50
  }

  return landmarks
}
