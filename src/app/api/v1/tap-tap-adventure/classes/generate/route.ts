import { NextResponse } from 'next/server'

import {
  generateClassFromSeed,
  pickRandomFallback,
  pickRandomSeeds,
} from '@/app/tap-tap-adventure/lib/classGenerator'
import { GeneratedClass } from '@/app/tap-tap-adventure/models/generatedClass'

export async function POST() {
  try {
    const seeds = pickRandomSeeds(4)
    const usedFallbackIds = new Set<string>()

    // Make 4 parallel LLM calls
    const results = await Promise.allSettled(
      seeds.map(seed => generateClassFromSeed(seed.style, seed.modifier))
    )

    const classes: GeneratedClass[] = []

    for (const result of results) {
      if (result.status === 'fulfilled') {
        classes.push(result.value)
      } else {
        // Pick a fallback class (no duplicates)
        const fallback = pickRandomFallback(usedFallbackIds)
        usedFallbackIds.add(fallback.id)
        classes.push(fallback)
      }
    }

    return NextResponse.json({ classes })
  } catch (error) {
    console.error('Error generating classes:', error)

    // Full fallback: return 4 random fallback classes
    const usedIds = new Set<string>()
    const fallbackClasses: GeneratedClass[] = []
    for (let i = 0; i < 4; i++) {
      const fallback = pickRandomFallback(usedIds)
      usedIds.add(fallback.id)
      fallbackClasses.push(fallback)
    }

    return NextResponse.json({ classes: fallbackClasses })
  }
}
