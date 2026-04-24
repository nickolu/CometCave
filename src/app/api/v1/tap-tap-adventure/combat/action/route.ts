import { NextRequest, NextResponse } from 'next/server'

import { getRegion } from '@/app/tap-tap-adventure/config/regions'
import { processPlayerAction, getCombatRewards } from '@/app/tap-tap-adventure/lib/combatEngine'
import { applyDeathPenalty } from '@/app/tap-tap-adventure/lib/deathPenalty'
import { getSpellLevel } from '@/app/tap-tap-adventure/lib/spellProgression'
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
      const regionMult = getRegion(character.currentRegion ?? 'green_meadows').difficultyMultiplier
      rewards = getCombatRewards(updatedCombat, character, regionMult)
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

    // Grant spell XP if a spell was cast this turn
    if (actionParsed.action === 'cast_spell' && actionParsed.spellId) {
      const castLog = updatedCombat.combatLog.find(
        (l: any) => l.turn === updatedCombat.turnNumber && l.actor === 'player' && l.action === 'cast_spell' && !l.description?.includes('fizzle')
      )
      if (castLog && updatedCharacter.spellbook) {
        const spellIdx = updatedCharacter.spellbook.findIndex((s: any) => s.id === actionParsed.spellId)
        if (spellIdx >= 0) {
          const spell = updatedCharacter.spellbook[spellIdx]
          const newXp = (spell.spellXp ?? 0) + 1
          const newLevel = getSpellLevel(newXp)
          updatedCharacter = {
            ...updatedCharacter,
            spellbook: updatedCharacter.spellbook.map((s: any, i: number) =>
              i === spellIdx ? { ...s, spellXp: newXp, spellLevel: newLevel } : s
            ),
          }
        }
      }
    }

    // If mount died in combat, remove it from character
    if (result.mountDied) {
      updatedCharacter = { ...updatedCharacter, activeMount: null }
    }

    // Persist mercenary HP from combat state back to character
    if (updatedCombat.playerState.mercenaryHp !== undefined && updatedCharacter.activeMercenary) {
      updatedCharacter = {
        ...updatedCharacter,
        activeMercenary: {
          ...updatedCharacter.activeMercenary,
          hp: updatedCombat.playerState.mercenaryHp,
        },
      }
    }

    // Persist party member HP from combat state back to character
    if (updatedCombat.partyMemberStates?.length && updatedCharacter.party?.length) {
      updatedCharacter = {
        ...updatedCharacter,
        party: updatedCharacter.party.map((member: any) => {
          const combatMember = updatedCombat.partyMemberStates?.find((m: any) => m.memberId === member.id)
          if (!combatMember) return member
          // After victory, KO'd members get 1 HP back
          const postCombatHp = combatMember.isKnockedOut && updatedCombat.status === 'victory'
            ? 1
            : combatMember.hp
          return { ...member, hp: Math.max(0, postCombatHp) }
        }),
      }
    }

    return NextResponse.json({
      combatState: updatedCombat,
      rewards,
      updatedCharacter,
      consumedItemId: result.consumedItemId,
      deathPenalty,
      turnPhase: updatedCombat.turnPhase ?? 'player',
    })
  } catch (err) {
    console.error('Error processing combat action', err)
    return NextResponse.json(
      { error: 'Failed to process combat action', details: (err as Error).message },
      { status: 500 }
    )
  }
}
