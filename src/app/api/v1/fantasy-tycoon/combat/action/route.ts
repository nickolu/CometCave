import { NextRequest, NextResponse } from 'next/server'

import { processPlayerAction, getCombatRewards } from '@/app/fantasy-tycoon/lib/combatEngine'
import { applyXpGain } from '@/app/fantasy-tycoon/lib/leveling'
import { CombatActionRequestSchema } from '@/app/fantasy-tycoon/models/combat'

export async function POST(req: NextRequest) {
  try {
    const { combatState, action, character } = await req.json()

    const actionParsed = CombatActionRequestSchema.parse(action)
    const result = processPlayerAction(combatState, actionParsed, character)
    const updatedCombat = result.combatState

    let rewards = undefined
    let updatedCharacter = character

    if (updatedCombat.status === 'victory') {
      rewards = getCombatRewards(updatedCombat, character)
      updatedCharacter = {
        ...character,
        gold: character.gold + rewards.gold,
      }
      const levelResult = applyXpGain(updatedCharacter, rewards.xp)
      updatedCharacter = levelResult.character
      rewards = {
        ...rewards,
        leveledUp: levelResult.leveledUp,
        newLevel: levelResult.character.level,
      }
    } else if (updatedCombat.status === 'defeat') {
      const goldLoss = Math.floor(character.gold * 0.1)
      updatedCharacter = {
        ...character,
        gold: Math.max(0, character.gold - goldLoss),
      }
      rewards = { xp: 0, gold: -goldLoss, loot: [] }
    } else if (updatedCombat.status === 'fled') {
      const goldLoss = Math.floor(character.gold * 0.05)
      updatedCharacter = {
        ...character,
        gold: Math.max(0, character.gold - goldLoss),
      }
      rewards = { xp: 0, gold: -goldLoss, loot: [] }
    }

    return NextResponse.json({
      combatState: updatedCombat,
      rewards,
      updatedCharacter,
      consumedItemId: result.consumedItemId,
    })
  } catch (err) {
    console.error('Error processing combat action', err)
    return NextResponse.json(
      { error: 'Failed to process combat action', details: (err as Error).message },
      { status: 500 }
    )
  }
}
