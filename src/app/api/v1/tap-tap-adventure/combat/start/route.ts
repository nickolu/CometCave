import { NextRequest, NextResponse } from 'next/server'

import { getDifficultyModifiers } from '@/app/tap-tap-adventure/config/difficultyModes'
import { getRegion } from '@/app/tap-tap-adventure/config/regions'
import { buildStoryContext } from '@/app/tap-tap-adventure/lib/contextBuilder'
import { initializePlayerCombatState } from '@/app/tap-tap-adventure/lib/combatEngine'
import { generateCombatEncounter, generateBossEncounter, generateMiniBossEncounter, generateFinalBossEncounter } from '@/app/tap-tap-adventure/lib/combatGenerator'
import { CombatState } from '@/app/tap-tap-adventure/models/combat'

export async function POST(req: NextRequest) {
  try {
    const { character, storyEvents = [], eventContext, isBoss = false, isMiniBoss = false, isSecretBoss = false, pendingRegionId } = await req.json()
    const storyContext = buildStoryContext(character, storyEvents)

    // Build context string — for secret bosses, emphasize the guardian nature
    const secretBossPrefix = isSecretBoss
      ? `A powerful ancient guardian protects this secret place. Generate a formidable boss-level guardian enemy that feels mythic and dangerous.\n\n`
      : ''
    const fullContext = eventContext
      ? `${secretBossPrefix}The player chose to fight in this situation: "${eventContext}"\n\nGenerate an enemy that matches this encounter. The enemy should be the creature or opponent described in the event above.\n\n${storyContext}`
      : `${secretBossPrefix}${storyContext}`

    const isFinalBoss = pendingRegionId === 'celestial_throne'

    // Secret boss always uses boss-level generation
    const effectiveIsBoss = isBoss || isSecretBoss

    const { enemy: rawEnemy, scenario } = isFinalBoss
      ? await generateFinalBossEncounter(character, fullContext)
      : isMiniBoss
        ? await generateMiniBossEncounter(character, fullContext)
        : effectiveIsBoss
          ? await generateBossEncounter(character, fullContext)
          : await generateCombatEncounter(character, fullContext)

    // Apply difficulty modifiers and region difficulty multiplier to enemy stats
    const diffMods = getDifficultyModifiers(character.difficultyMode)
    const region = getRegion(character.currentRegion ?? 'green_meadows')
    const regionMult = region.difficultyMultiplier
    // Secret bosses get an additional 2x scaling on top of regular modifiers
    const secretBossMultiplier = isSecretBoss ? 2.0 : 1.0
    // Determine enemy range type based on element and name
    const enemyNameLower = rawEnemy.name.toLowerCase()
    const rangedByElement = rawEnemy.element === 'arcane' || rawEnemy.element === 'shadow'
    const rangedByName = ['mage', 'archer', 'caster', 'wizard', 'sorcerer', 'shaman'].some(k =>
      enemyNameLower.includes(k)
    )
    const enemyRange: 'melee' | 'ranged' = rangedByElement || rangedByName ? 'ranged' : 'melee'

    const enemy = {
      ...rawEnemy,
      hp: Math.round(rawEnemy.hp * diffMods.enemyHpMultiplier * regionMult * secretBossMultiplier),
      maxHp: Math.round(rawEnemy.maxHp * diffMods.enemyHpMultiplier * regionMult * secretBossMultiplier),
      attack: Math.round(rawEnemy.attack * diffMods.enemyAttackMultiplier * regionMult * secretBossMultiplier),
      defense: Math.round(rawEnemy.defense * regionMult * secretBossMultiplier),
      goldReward: Math.round(rawEnemy.goldReward * regionMult * secretBossMultiplier),
      range: enemyRange,
    }

    const playerState = initializePlayerCombatState(character)

    // Initialize party member combat states
    const partyMemberStates = ((character.party ?? []) as any[])
      .filter((m: any) => m.role === 'combatant' && m.hp > 0)
      .map((m: any) => ({
        memberId: m.id,
        name: m.customName ?? m.name,
        icon: m.icon ?? '⚔️',
        hp: m.hp,
        maxHp: m.maxHp,
        attack: m.stats?.strength ?? 5,
        defense: Math.floor((m.stats?.strength ?? 5) / 2),
        isKnockedOut: false,
      }))

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
      isBoss: isFinalBoss ? true : effectiveIsBoss,
      isMiniBoss,
      isFinalBoss: isFinalBoss || undefined,
      isSecretBoss: isSecretBoss || undefined,
      combatDistance: region.startingCombatDistance ?? 'mid',
      ...(pendingRegionId ? { pendingRegionId } : {}),
      partyMemberStates: partyMemberStates.length > 0 ? partyMemberStates : undefined,
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
