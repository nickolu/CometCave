'use client'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/types'
import { getRegion, REGIONS } from '@/app/tap-tap-adventure/config/regions'

interface TavernPanelProps {
  character: FantasyCharacter
  townName: string
  onRest: () => void
  isResting: boolean
  onClose: () => void
}

const TAVERN_FLAVORS: Record<string, string> = {
  hearthwood: 'The hearth crackles warmly as the barkeep polishes a well-worn mug. The smell of roasted meat and fresh bread fills the cozy room.',
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
    <div className="bg-[#1e1f30] border border-[#3a3c56] rounded-lg p-3 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <span className="text-sm font-bold text-amber-400">🍺 Tavern &amp; Inn</span>
        <button className="text-slate-400 hover:text-white text-sm" onClick={onClose}>✕</button>
      </div>

      {/* Atmosphere */}
      <div className="text-[11px] text-slate-300 leading-relaxed italic bg-[#181929] border border-[#2a2c42] rounded p-2">
        {flavor}
      </div>

      {/* Rest section */}
      <div>
        <h4 className="text-xs font-semibold text-slate-400 uppercase border-b border-[#3a3c56] pb-1 mb-2">
          Rest &amp; Recover
        </h4>
        <div className="bg-[#252638] border border-[#3a3c56] rounded p-2 space-y-2">
          <div className="flex gap-4 text-[10px]">
            <span>
              <span className="text-slate-400">HP </span>
              <span className="text-red-400 font-semibold">{hp}</span>
              <span className="text-slate-600"> / {maxHp}</span>
            </span>
            <span>
              <span className="text-slate-400">MP </span>
              <span className="text-blue-400 font-semibold">{mana}</span>
              <span className="text-slate-600"> / {maxMana}</span>
            </span>
            <span>
              <span className="text-amber-300 font-semibold">🪙 {character.gold} gold</span>
            </span>
          </div>
          <div className="text-[10px] text-slate-400">
            A night&apos;s rest costs <span className="text-amber-300 font-semibold">{innCost} gold</span> and fully restores HP and MP.
          </div>
          {isFullHealth ? (
            <div className="text-[10px] text-green-400 italic">You are already at full health and mana.</div>
          ) : !canAfford ? (
            <div className="text-[10px] text-red-400 italic">
              Not enough gold. You need {innCost}g (have {character.gold ?? 0}g).
            </div>
          ) : null}
          <button
            className={`text-[10px] px-3 py-1.5 rounded transition-colors font-semibold ${
              canAfford && !isResting
                ? 'bg-teal-900/50 text-teal-300 hover:bg-teal-800/60'
                : 'bg-slate-700/40 text-slate-500 cursor-not-allowed opacity-60'
            }`}
            disabled={!canAfford || isResting}
            onClick={onRest}
          >
            {isResting ? 'Resting...' : `Rest (${innCost} gold)`}
          </button>
        </div>
      </div>

      {/* Rumors section */}
      <div>
        <h4 className="text-xs font-semibold text-slate-400 uppercase border-b border-[#3a3c56] pb-1 mb-2">
          Tavern Rumors
        </h4>
        <div className="space-y-2">
          {rumors.map((rumor, i) => (
            <div key={i} className="flex gap-1.5 text-[10px] text-slate-400 italic leading-relaxed">
              <span className="shrink-0">💬</span>
              <span>{rumor}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Back button */}
      <button
        className="w-full text-xs text-slate-400 hover:text-slate-200 py-1 transition-colors"
        onClick={onClose}
      >
        Back to Town
      </button>
    </div>
  )
}
