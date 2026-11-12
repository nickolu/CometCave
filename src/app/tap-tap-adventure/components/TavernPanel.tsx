'use client'

/**
 * The tavern, set on the town's bill: the room described, a night's rest
 * priced on brass, and what the regulars are saying.
 */
import { REGIONS, getRegion } from '@/app/tap-tap-adventure/config/regions'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/types'
import { CloseIcon } from '@/app/tap-tap-adventure/stage/icons'
import { BrassFigure, BrassPlate, PaperButton, PlaybillCaption, PlaybillTitle } from '@/app/tap-tap-adventure/stage/Playbill'

interface TavernPanelProps {
  character: FantasyCharacter
  townName: string
  onRest: () => void
  isResting: boolean
  onClose: () => void
}

const TAVERN_FLAVORS: Record<string, string> = {
  green_meadows: 'Farmers and merchants share tables over simple fare. A bard in the corner plays a gentle melody on a worn lute.',
  dark_forest: 'Lantern light flickers across rough-hewn walls. The patrons speak in hushed tones, glancing toward the dark windows.',
  sunken_ruins: 'Water drips from the ceiling into carefully placed buckets. The air tastes of salt and the drinks are suspiciously warm.',
  feywild_grove: 'The tables float slightly above the ground. Your drink changes color each time you look away, but it always tastes pleasant.',
  crystal_caves: 'Luminescent crystals serve as lanterns. The miners around you nurse their drinks with calloused hands, sharing stories of what they\'ve found below.',
  bone_wastes: 'The bar is made from a massive rib bone. The drinks are strong and the atmosphere grim, but the warmth is welcome.',
  scorched_wastes: 'A blessed breeze from enchanted fans keeps the heat at bay. Cool water is the most popular order here.',
  frozen_peaks: 'A roaring fire dominates the room. Everyone huddles close, thawing frozen limbs and sharing tales of the mountain passes.',
  volcanic_forge: 'The natural heat from the caldera keeps the room uncomfortably warm. The forge-master\'s apprentices drink deeply between shifts.',
  dragons_spine: 'Dragon scale decorations line the walls. The patrons here are battle-hardened, and stories of narrow escapes fill the air.',
  shadow_realm: 'The tavern flickers in and out of solidity. Your mug feels both real and dreamlike. The barkeep\'s face is hard to remember.',
  sky_citadel: 'Wind howls past the windows of this floating establishment. The view is breathtaking if you dare to look down.',
  abyssal_depths: 'Bioluminescent organisms provide dim light. The drinks are exotic and the pressure makes everything taste slightly different.',
  celestial_throne: 'Divine light streams through impossible windows. The nectar served here is said to grant brief moments of clarity beyond mortal understanding.',
}

function getTavernFlavor(regionId: string): string {
  return TAVERN_FLAVORS[regionId] ?? 'The tavern is warm and welcoming. The smell of ale and woodsmoke mingles with the sound of laughter and clinking mugs.'
}

function generateRumors(character: FantasyCharacter): string[] {
  const region = getRegion(character.currentRegion ?? 'green_meadows')
  const rumors: string[] = []

  // Rumor about connected regions
  const connectedIds = region.connectedRegions.filter(id => id !== (character.currentRegion ?? 'green_meadows'))
  if (connectedIds.length > 0) {
    const connectedRegion = REGIONS[connectedIds[0]]
    if (connectedRegion) {
      rumors.push(`Travelers speak of ${connectedRegion.icon} ${connectedRegion.name} — said to be ${connectedRegion.description.split('.')[0].toLowerCase()}.`)
    }
    if (connectedIds.length > 1) {
      const second = REGIONS[connectedIds[1]]
      if (second) {
        rumors.push(`Merchants warn that ${second.name} grows more dangerous by the day. Only seasoned adventurers dare venture there.`)
      }
    }
  }

  // Rumor about unexplored landmarks
  const unexplored = (character.landmarkState?.landmarks ?? []).filter(lm => !lm.explored && !lm.hidden)
  if (unexplored.length > 0) {
    const lm = unexplored[0]
    rumors.push(`Locals whisper of ${lm.icon} ${lm.name} nearby — few have ventured inside and returned to tell the tale.`)
  }

  // Rumor about hidden landmarks
  const hidden = (character.landmarkState?.landmarks ?? []).filter(lm => lm.hidden)
  if (hidden.length > 0) {
    rumors.push(`An old wanderer mutters something about a secret place hidden in this region, but refuses to say more.`)
  }

  // Fallback regional flavor
  if (rumors.length < 2) {
    rumors.push(`The ${region.theme.split(',')[0]} here is said to hold ancient secrets for those patient enough to seek them.`)
  }

  return rumors.slice(0, 3)
}

export function TavernPanel({ character, townName, onRest, isResting, onClose }: TavernPanelProps) {
  const regionId = character.currentRegion ?? 'green_meadows'
  const region = getRegion(regionId)
  const innCost = Math.round(10 * region.difficultyMultiplier)
  const canAfford = (character.gold ?? 0) >= innCost
  const hp = character.hp ?? character.maxHp ?? 0
  const maxHp = character.maxHp ?? 100
  const mana = character.mana ?? character.maxMana ?? 0
  const maxMana = character.maxMana ?? 50
  const isFullHealth = hp >= maxHp && mana >= maxMana

  const rumors = generateRumors(character)
  const flavor = getTavernFlavor(regionId)

  return (
    <section aria-label={`The tavern in ${townName}`}>
      <div className="flex items-start gap-2">
        <PlaybillTitle size="sm" className="min-w-0 flex-1">Tavern &amp; Inn</PlaybillTitle>
        <PaperButton variant="outline" size="sm" className="w-8 shrink-0 px-0" onClick={onClose} aria-label="Close tavern">
          <CloseIcon />
        </PaperButton>
      </div>

      <p className="mt-3 font-body text-sm italic leading-relaxed text-ps-ink-soft">{flavor}</p>

      {/* Rest */}
      <PlaybillCaption className="mt-4">Rest and recover</PlaybillCaption>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <BrassPlate className="flex items-stretch divide-x-2 divide-ps-brass-deep">
          <BrassFigure label="HP" value={<>{hp}<span className="text-sm text-ps-ink/70">/{maxHp}</span></>} bar={maxHp > 0 ? hp / maxHp : 0} barTone={hp / Math.max(1, maxHp) < 0.35 ? 'red' : 'green'} />
          <BrassFigure label="MP" value={<>{mana}<span className="text-sm text-ps-ink/70">/{maxMana}</span></>} bar={maxMana > 0 ? mana / maxMana : 0} />
          <BrassFigure label="A night" value={<>{innCost}<span className="text-sm">g</span></>} />
        </BrassPlate>
        <p className="min-w-[10rem] flex-1 font-body text-sm leading-snug text-ps-ink">
          A night&apos;s rest costs <span className="font-playbill tabular-nums">{innCost} gold</span> and fully restores HP and MP.
        </p>
      </div>
      {isFullHealth ? (
        <p className="mt-2 font-body text-sm italic text-ps-stamp-green">You are already at full health and mana.</p>
      ) : !canAfford ? (
        <p className="mt-2 font-body text-sm italic text-ps-stamp-red">
          Not enough gold. You need {innCost}g (have {character.gold ?? 0}g).
        </p>
      ) : null}
      <PaperButton variant="brass" className="mt-3 w-full sm:w-auto" disabled={!canAfford || isResting} onClick={onRest}>
        {isResting ? 'Resting…' : <>Rest · <span className="tabular-nums">{innCost} g</span></>}
      </PaperButton>

      {/* Company */}
      <PlaybillCaption className="mt-5">Looking for company</PlaybillCaption>
      <p className="mt-2 font-body text-sm leading-snug text-ps-ink">
        Companions and mercenaries for hire are listed in the Party drawer while you are in town.
      </p>

      {/* Rumors */}
      <PlaybillCaption className="mt-5">Tavern rumors</PlaybillCaption>
      <ul className="mt-2 space-y-2">
        {rumors.map((rumor, i) => (
          <li key={i} className="flex gap-2 font-body text-sm italic leading-relaxed text-ps-ink">
            <span aria-hidden className="shrink-0 text-ps-ink-soft">—</span>
            <span>{rumor}</span>
          </li>
        ))}
      </ul>

      <PaperButton variant="outline" className="mt-5 w-full border-ps-ink/50 text-ps-ink-soft" onClick={onClose}>
        Back to town
      </PaperButton>
    </section>
  )
}
