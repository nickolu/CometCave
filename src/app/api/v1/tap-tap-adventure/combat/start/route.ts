import { NextRequest, NextResponse } from 'next/server'

import { getDifficultyModifiers } from '@/app/tap-tap-adventure/config/difficultyModes'
import { getRegion } from '@/app/tap-tap-adventure/config/regions'
import { buildStoryContext } from '@/app/tap-tap-adventure/lib/contextBuilder'
import { initializePlayerCombatState } from '@/app/tap-tap-adventure/lib/combatEngine'
import { generateCombatEncounter, generateBossEncounter, generateMiniBossEncounter, generateFinalBossEncounter } from '@/app/tap-tap-adventure/lib/combatGenerator'
import { CombatState } from '@/app/tap-tap-adventure/models/combat'

export async function POST(req: NextRequest) {
  try {
    const { character, storyEvents = [], eventContext, isBoss = false, isMiniBoss = false, pendingRegionId, isSecretBoss = false } = await req.json()
    const storyContext = buildStoryContext(character, storyEvents)
    const fullContext = eventContext
      ? `The player chose to fight in this situation: "${eventContext}"\n\nGenerate an enemy that matches this encounter. The enemy should be the creature or opponent described in the event above.\n\n${storyContext}`
      : storyContext

    const isFinalBoss = pendingRegionId === 'celestial_throne'

    const { enemy: rawEnemy, scenario } = isFinalBoss
      ? await generateFinalBossEncounter(character, fullContext)
      : isMiniBoss
        ? await generateMiniBossEncounter(character, fullContext)
        : isBoss
          ? await generateBossEncounter(character, fullContext)
          : await generateCombatEncounter(character, fullContext)

    // Apply difficulty modifiers and region difficulty multiplier to enemy stats
    const diffMods = getDifficultyModifiers(character.difficultyMode)
    const region = getRegion(character.currentRegion ?? 'green_meadows')
    const regionMult = region.difficultyMultiplier
    // Determine enemy range type based on element and name
    const enemyNameLower = rawEnemy.name.toLowerCase()
    const rangedByElement = rawEnemy.element === 'arcane' || rawEnemy.element === 'shadow'
    const rangedByName = ['mage', 'archer', 'caster', 'wizard', 'sorcerer', 'shaman'].some(k =>
      enemyNameLower.includes(k)
    )
    const enemyRange: 'melee' | 'ranged' = rangedByElement || rangedByName ? 'ranged' : 'melee'

    const enemy = {
      ...rawEnemy,
      hp: Math.round(rawEnemy.hp * diffMods.enemyHpMultiplier * regionMult),
      maxHp: Math.round(rawEnemy.maxHp * diffMods.enemyHpMultiplier * regionMult),
      attack: Math.round(rawEnemy.attack * diffMods.enemyAttackMultiplier * regionMult),
      defense: Math.round(rawEnemy.defense * regionMult),
      goldReward: Math.round(rawEnemy.goldReward * regionMult),
      range: enemyRange,
    }

    const playerState = initializePlayerCombatState(character)

    // Clear exploration shield — it's been consumed by combat init
    const updatedCharacter = character.explorationShield
      ? { ...character, explorationShield: 0 }
      : character

    const combatState: CombatState = {
      id: `combat-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      eventId: `event-combat-${Date.now()}`,
      enemy,
      playerState,
      turnNumber: 0,
      combatLog: [],
      status: 'active',
      scenario,
      isBoss: isFinalBoss ? true : isBoss,
      isMiniBoss,
      isFinalBoss: isFinalBoss || undefined,
      isSecretBoss: isSecretBoss || undefined,
      combatDistance: region.startingCombatDistance ?? 'mid',
      ...(pendingRegionId ? { pendingRegionId } : {}),
    }

    return NextResponse.json({ combatState, updatedCharacter: character.explorationShield ? updatedCharacter : undefined })
  } catch (err) {
    console.error('Error starting combat', err)
    return NextResponse.json(
      { error: 'Failed to start combat', details: (err as Error).message },
      { status: 500 }
    )
  }
}
