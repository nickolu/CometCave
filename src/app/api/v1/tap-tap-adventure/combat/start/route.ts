import { NextRequest, NextResponse } from 'next/server'

import { buildStoryContext } from '@/app/tap-tap-adventure/lib/contextBuilder'
import { initializePlayerCombatState } from '@/app/tap-tap-adventure/lib/combatEngine'
import { generateCombatEncounter } from '@/app/tap-tap-adventure/lib/combatGenerator'
import { CombatState } from '@/app/tap-tap-adventure/models/combat'

export async function POST(req: NextRequest) {
  try {
    const { character, storyEvents = [] } = await req.json()
    const context = buildStoryContext(character, storyEvents)
    const { enemy, scenario } = await generateCombatEncounter(character, context)
    const playerState = initializePlayerCombatState(character)

    const combatState: CombatState = {
      id: `combat-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      eventId: `event-combat-${Date.now()}`,
      enemy,
      playerState,
      turnNumber: 0,
      combatLog: [],
      status: 'active',
      scenario,
    }

    return NextResponse.json({ combatState })
  } catch (err) {
    console.error('Error starting combat', err)
    return NextResponse.json(
      { error: 'Failed to start combat', details: (err as Error).message },
      { status: 500 }
    )
  }
}
