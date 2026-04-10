import { NextRequest, NextResponse } from 'next/server'

import { processPlayerAction, getCombatRewards } from '@/app/tap-tap-adventure/lib/combatEngine'
import { applyDeathPenalty } from '@/app/tap-tap-adventure/lib/deathPenalty'
import { CombatActionRequestSchema } from '@/app/tap-tap-adventure/models/combat'

export async function POST(req: NextRequest) {
  try {
    const { combatState, action, character } = await req.json()

    const actionParsed = CombatActionRequestSchema.parse(action)
    const result = processPlayerAction(combatState, actionParsed, character)
    const updatedCombat = result.combatState

    let rewards = undefined
    let updatedCharacter = character
    let deathPenalty = undefined

    if (updatedCombat.status === 'victory') {
      rewards = getCombatRewards(updatedCombat, character)
      updatedCharacter = {
        ...character,
        gold: character.gold + rewards.gold,
      }
    } else if (updatedCombat.status === 'defeat') {
      const penaltyResult = applyDeathPenalty(character)
      updatedCharacter = penaltyResult.updatedCharacter
      deathPenalty = penaltyResult.penalty
      rewards = { gold: -penaltyResult.penalty.goldLost, loot: [] }
    } else if (updatedCombat.status === 'fled') {
      const goldLoss = Math.floor(character.gold * 0.05)
      updatedCharacter = {
        ...character,
        gold: Math.max(0, character.gold - goldLoss),
      }
      rewards = { gold: -goldLoss, loot: [] }
    }

    return NextResponse.json({
      combatState: updatedCombat,
      rewards,
      updatedCharacter,
      consumedItemId: result.consumedItemId,
      deathPenalty,
    })
  } catch (err) {
    console.error('Error processing combat action', err)
    return NextResponse.json(
      { error: 'Failed to process combat action', details: (err as Error).message },
      { status: 500 }
    )
  }
}
