import { CombatEnemy, CombatLogEntry } from '@/app/tap-tap-adventure/models/combat'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { FantasyStoryEvent } from '@/app/tap-tap-adventure/models/story'
import { calculateDay } from '@/app/tap-tap-adventure/lib/leveling'

function djb2Hash(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i)
  }
  return Math.abs(hash)
}

function pickFrom<T>(arr: T[], seed: string): T {
  return arr[djb2Hash(seed) % arr.length]
}

const elementLines: Record<string, string[]> = {
  fire: [
    'The flames of {enemy} consumed everything, leaving only ash and silence.',
    '{enemy} painted the world in fire and fury, and you were not spared.',
    'Heat and smoke swallowed you whole — {enemy} showed no mercy.',
    'You were undone by the inferno that is {enemy}, reduced to cinders before you could react.',
  ],
  ice: [
    'The cold embrace of {enemy} stilled your heart before your mind could catch up.',
    '{enemy} froze the last warmth from your body, leaving silence in its wake.',
    'Ice crept through your veins as {enemy} sealed your fate in frost.',
    'A chill beyond winter claimed you — {enemy} left nothing but silence and ice.',
  ],
  lightning: [
    'In a blinding instant, {enemy} struck with the wrath of a thousand storms.',
    '{enemy} called down thunder and you were not fast enough to escape its judgment.',
    'The sky itself answered {enemy}\'s call, and you were consumed in a flash of brilliant death.',
    'Lightning does not negotiate — {enemy} ended you before the thunder even sounded.',
  ],
  shadow: [
    '{enemy} reached from the dark places between worlds and dragged you under.',
    'The shadows that serve {enemy} swallowed you whole, leaving no trace.',
    'Darkness closed in from every angle — {enemy} made sure there was nowhere to run.',
    '{enemy} unraveled you from within, shadow by shadow, until nothing remained.',
  ],
  arcane: [
    'Reality itself bent to {enemy}\'s will, and you were erased from it.',
    '{enemy} rewrote the laws of the world — and your survival was not among them.',
    'Arcane forces beyond comprehension tore through your defenses at {enemy}\'s command.',
    'Magic ancient and terrible poured from {enemy}, and your fate was sealed in runes of ruin.',
  ],
  nature: [
    'The wild reclaimed what was never yours — {enemy} returned you to the earth.',
    '{enemy} called upon roots and thorns and venom, and the world answered.',
    'Nature does not forgive trespass. {enemy} reminded you of that with finality.',
    'Vines, wind, and hunger — {enemy} wielded them all, and you fell like a leaf in autumn.',
  ],
}

const specialAbilityLines = [
  '{enemy} unleashed {ability} with terrifying precision, and there was nothing left to do but fall.',
  'The dreaded {ability} of {enemy} proved to be your undoing in the end.',
  '{enemy}\'s {ability} struck at exactly the wrong moment — your last.',
  'You had heard tales of {ability}, but nothing could have prepared you for {enemy}\'s mastery of it.',
]

const criticalLines = [
  '{enemy} found the perfect opening and struck with devastating force. You never saw it coming.',
  'A killing blow — {enemy} hit harder than you thought possible, and that was that.',
  '{enemy} seized the moment and ended it with one catastrophic strike.',
  'One moment of weakness was all {enemy} needed. The killing blow was swift and merciless.',
]

const classLines: Record<string, string[]> = {
  warrior: [
    '{enemy} met a warrior and left them broken. Even the mightiest can fall.',
    'Steel met its match today. {enemy} proved the stronger blade.',
    'A warrior\'s death, swift and bloody — {enemy} gave no quarter.',
    '{enemy} bested you in the only language warriors understand: force.',
  ],
  mage: [
    'The spells ran dry and so did your luck. {enemy} closed the distance before you could recover.',
    '{enemy} shattered your concentration — without your magic, you were defenseless.',
    'Arcane mastery was not enough. {enemy} overwhelmed your defenses and ended the incantation.',
    'Even a mage\'s power has limits. {enemy} found yours.',
  ],
  rogue: [
    '{enemy} anticipated every feint. You had no trick left to play.',
    'The shadows offered no refuge this time. {enemy} found you all the same.',
    'Quick as you were, {enemy} was quicker — or at least more relentless.',
    'A rogue lives by the blade and dies by it too. {enemy} made sure of that.',
  ],
  ranger: [
    'The arrows ran out. {enemy} closed in before you could find footing to retreat.',
    '{enemy} gave you no distance to work with, and a ranger without distance is vulnerable.',
    'The wilderness has its own predators. Today, {enemy} was yours.',
    'Your aim was true, but {enemy} was truer. The hunt ended here.',
  ],
  paladin: [
    'Faith and steel were not enough today. {enemy} broke through your holy guard.',
    '{enemy} did not fear the light you carried. In the end, neither could save you.',
    'Even a paladin\'s conviction can be extinguished. {enemy} found a way.',
    'You stood firm in the face of {enemy} — and still you fell. There is no shame in that.',
  ],
  cleric: [
    'The healing prayers came too slowly. {enemy} struck faster than faith could mend.',
    '{enemy} overwhelmed your wards and silenced your prayers permanently.',
    'A cleric heals others — but today there was no one left to heal you. {enemy} saw to that.',
    'The gods were silent as {enemy} delivered the final blow.',
  ],
  bard: [
    'No song could sway {enemy}. The music stopped here.',
    '{enemy} cared nothing for your tales or your charms. The performance is over.',
    'Even the most captivating story must end. {enemy} wrote the final chapter.',
    'The audience fell silent. {enemy} brought the curtain down with brutal efficiency.',
  ],
  druid: [
    'The wild shapes failed you. {enemy} found you in a vulnerable moment and struck.',
    '{enemy} cut through bark and claw alike. Even nature\'s gifts have limits.',
    'The forest did not intervene. {enemy} proved stronger than the bonds of the wild.',
    'A druid\'s power flows from the land — but this land belonged to {enemy}.',
  ],
}

const genericLines = [
  '{enemy} proved to be more than you could handle. The road ends here.',
  'This battle was not yours to win. {enemy} made certain of that.',
  'You gave everything. {enemy} gave more. The outcome was inevitable.',
  'Even the bravest adventurer meets their match. Today, it was {enemy}.',
  'The dice were not in your favor. {enemy} claimed what the fates offered.',
  'Courage alone could not carry you through. {enemy} was the stronger force today.',
]

export function getDeathFlavorText(
  character: FantasyCharacter | null | undefined,
  enemy: CombatEnemy,
  combatLog: CombatLogEntry[]
): string {
  const seed = (character?.id ?? 'unknown') + enemy.name

  const fill = (template: string) =>
    template
      .replace(/{enemy}/g, enemy.name)
      .replace(/{ability}/g, enemy.specialAbility?.name ?? 'special ability')

  // 1. Element-based
  if (enemy.element && enemy.element !== 'none') {
    const lines = elementLines[enemy.element]
    if (lines) {
      return fill(pickFrom(lines, seed + 'element'))
    }
  }

  // 2. Special ability
  if (enemy.specialAbility) {
    return fill(pickFrom(specialAbilityLines, seed + 'special'))
  }

  // 3. Killing blow (last enemy log entry is critical)
  const lastEnemyEntry = [...combatLog].reverse().find(e => e.actor === 'enemy')
  if (lastEnemyEntry?.isCritical) {
    return fill(pickFrom(criticalLines, seed + 'crit'))
  }

  // 4. Class-based
  const charClass = character?.class?.toLowerCase()
  if (charClass && classLines[charClass]) {
    return fill(pickFrom(classLines[charClass], seed + 'class'))
  }

  // 5. Generic fallback
  return fill(pickFrom(genericLines, seed + 'generic'))
}

export function getStoryContext(
  character: FantasyCharacter | null | undefined,
  storyEvents: FantasyStoryEvent[]
): string | null {
  if (!character) return null

  // 1. First death
  if ((character.deathCount ?? 0) === 0) {
    const day = calculateDay(character.distance)
    return `This was their first fall, on day ${day}.`
  }

  // 2. Victory count
  const victoryCount = storyEvents.filter(e => e.type === 'combat_victory').length
  if (victoryCount > 0) {
    return `They had bested ${victoryCount} foe${victoryCount === 1 ? '' : 's'} before this fateful encounter.`
  }

  // 3. High level
  if (character.level >= 10) {
    return `A seasoned adventurer of level ${character.level}, cut down at the height of their power.`
  }

  // 4. Long distance
  if (character.distance > 1000) {
    return `After ${character.distance} km into the unknown, the journey ends here.`
  }

  return null
}

export function getPermadeathEpitaph(
  character: FantasyCharacter | null | undefined,
  storyEvents: FantasyStoryEvent[]
): string | null {
  if (!character || character.difficultyMode !== 'ironman') return null

  const days = calculateDay(character.distance)
  const race = character.race ?? 'unknown'
  const charClass = character.class ?? 'adventurer'
  const name = character.name ?? 'The fallen'
  const level = character.level ?? 1

  return (
    `Here lies ${name}, a level ${level} ${race} ${charClass}. ` +
    `They survived ${days} day${days === 1 ? '' : 's'} in the wilderness before meeting their end. ` +
    `May their legend echo through the ages.`
  )
}
