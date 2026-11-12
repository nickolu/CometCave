'use client'

/**
 * Numbers live on brass. The plate under the footlights carries HP, gold,
 * reputation and level; the placards on the top band name where and when
 * you are, the weather, and who is riding or walking with you.
 */
import { useEffect, useRef, useState } from 'react'

import { getDifficultyMode } from '@/app/tap-tap-adventure/config/difficultyModes'
import { getRegion } from '@/app/tap-tap-adventure/config/regions'
import { WEATHER_TYPES, type WeatherId } from '@/app/tap-tap-adventure/config/weather'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { getReputationTier } from '@/app/tap-tap-adventure/lib/contextBuilder'
import { calculateDay, levelProgress, stepsRequiredForLevel, stepsToNextLevel } from '@/app/tap-tap-adventure/lib/leveling'
import { getMountDisplayName } from '@/app/tap-tap-adventure/lib/mountUtils'
import type { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'

import { RegionGlyph, ResourceGlyph, WeatherGlyph } from './glyphs'
import { BrassFigure, BrassPlate, Placard, Stamp, deltaTone } from './Playbill'
import { TIME_LABEL, getTimeOfDay } from './time'

interface Delta {
  id: string
  key: 'hp' | 'gold' | 'reputation'
  delta: number
}

export function HudPlate({ character }: { character: FantasyCharacter | null }) {
  const hp = character?.hp ?? character?.maxHp ?? 100
  const maxHp = character?.maxHp ?? 100
  const gold = character?.gold ?? 0
  const reputation = character?.reputation ?? 0
  const level = character?.level ?? 1
  const distance = character?.distance ?? 0
  const progress = character ? levelProgress(distance) : 0
  const stepsNeeded = stepsToNextLevel(level)
  const stepsIntoLevel = distance - stepsRequiredForLevel(level)
  const hpPct = maxHp > 0 ? hp / maxHp : 0

  // Stamps rise off the plate when a number moves.
  const [deltas, setDeltas] = useState<Delta[]>([])
  const prev = useRef<{ hp?: number; gold?: number; reputation?: number }>({})
  useEffect(() => {
    const next: Delta[] = []
    const cur = { hp, gold, reputation }
    ;(['hp', 'gold', 'reputation'] as const).forEach(key => {
      const p = prev.current[key]
      if (p !== undefined && p !== cur[key]) next.push({ id: `${key}-${Date.now()}`, key, delta: cur[key] - p })
      prev.current[key] = cur[key]
    })
    if (next.length === 0) return
    const raf = requestAnimationFrame(() => setDeltas(d => [...d, ...next].slice(-6)))
    const ids = next.map(n => setTimeout(() => setDeltas(d => d.filter(x => x.id !== n.id)), 1400))
    return () => {
      cancelAnimationFrame(raf)
      ids.forEach(clearTimeout)
    }
  }, [hp, gold, reputation])

  const stampFor = (key: Delta['key']) =>
    deltas
      .filter(d => d.key === key)
      .map(d => (
        <span key={d.id} className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 animate-float-up">
          <Stamp tone={deltaTone(d.delta)} animate className="bg-ps-playbill">
            {d.delta > 0 ? `+${d.delta}` : d.delta}
          </Stamp>
        </span>
      ))

  return (
    <BrassPlate className="grid grid-cols-4 items-stretch divide-x-2 divide-ps-brass-deep/60" aria-label="Your figures">
      <div className="relative">
        {stampFor('hp')}
        <BrassFigure
          label="Health"
          value={hp}
          sub={`of ${maxHp}`}
          bar={hpPct}
          barTone={hpPct > 0.5 ? 'green' : hpPct > 0.25 ? 'ink' : 'red'}
          title={`HP ${hp} of ${maxHp}`}
        />
      </div>
      <div className="relative">
        {stampFor('gold')}
        <BrassFigure label="Gold" value={gold} />
      </div>
      <div className="relative">
        {stampFor('reputation')}
        <BrassFigure label="Repute" value={reputation} sub={getReputationTier(reputation)} title={`Reputation ${reputation}: ${getReputationTier(reputation)}`} />
      </div>
      <BrassFigure
        label="Level"
        value={level}
        sub={`${Math.max(0, stepsIntoLevel)} of ${stepsNeeded} km`}
        bar={progress}
        title={`Level ${level}: ${Math.max(0, stepsIntoLevel)} of ${stepsNeeded} km walked toward the next`}
      />
    </BrassPlate>
  )
}

export function Identity({ character }: { character: FantasyCharacter | null }) {
  if (!character) return <span className="font-playbill text-lg uppercase tracking-widest text-ps-brass-light">Tap Tap Adventure</span>
  return (
    <div className="flex min-w-0 flex-col leading-tight">
      <span className="truncate font-playbill text-base uppercase tracking-wide text-ps-playbill sm:text-lg">{character.name}</span>
      <span className="truncate font-label text-xs font-bold uppercase tracking-widest text-ps-brass-light">
        Lv {character.level} {character.race} {character.class}
      </span>
    </div>
  )
}

export function Placards({ character }: { character: FantasyCharacter | null }) {
  const { setMount } = useGameStore()
  const distance = character?.distance ?? 0
  const level = character?.level ?? 1
  const region = getRegion(character?.currentRegion ?? 'green_meadows')
  const day = calculateDay(distance)
  const time = getTimeOfDay(distance)
  const weather = WEATHER_TYPES[(character?.currentWeather ?? 'clear') as WeatherId] ?? WEATHER_TYPES.clear
  const difficulty = getDifficultyMode(character?.difficultyMode ?? 'normal')
  const levelDiff = (region.minLevel ?? 0) - level
  const mult = region.difficultyMultiplier ?? 1
  const danger = levelDiff >= 4 ? 'Deadly' : levelDiff >= 2 ? 'Hard going' : mult >= 1.5 ? 'Tough' : null
  const mount = character?.activeMount
  const merc = character?.activeMercenary

  return (
    <>
      <Placard title={region.description}>
        <RegionGlyph id={region.id} />
        {region.name}
      </Placard>
      <Placard title={`${Math.round(distance)} km walked`} className="hidden sm:inline-flex">
        Day {day} · {TIME_LABEL[time]}
      </Placard>
      {weather.id !== 'clear' && (
        <Placard title={weather.description}>
          <WeatherGlyph id={weather.id} />
          {weather.name}
        </Placard>
      )}
      {danger && (
        <Placard tone="danger" title={`Recommended level ${region.minLevel}+ (${mult}x)`}>
          {danger}
        </Placard>
      )}
      {difficulty.id !== 'normal' && (
        <Placard tone="paper" title={difficulty.description}>
          {difficulty.name}
        </Placard>
      )}
      {mount && (
        <Placard
          tone="paper"
          title={`${getMountDisplayName(mount)} · ${mount.dailyCost} gold a day${mount.hp != null && mount.maxHp != null ? ` · HP ${mount.hp}/${mount.maxHp}` : ''}`}
        >
          <ResourceGlyph kind="mount" />
          <span className="hidden sm:inline">{getMountDisplayName(mount)}</span>
          {mount.hp != null && mount.maxHp != null && <span className="opacity-70">{mount.hp}/{mount.maxHp}</span>}
          <button
            type="button"
            onClick={() => setMount(null)}
            className="ml-1 rounded-[2px] border border-ps-stamp-red px-1 text-xs text-ps-stamp-red hover:bg-ps-stamp-red hover:text-ps-playbill focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ds-primary"
            aria-label={`Release ${getMountDisplayName(mount)}`}
          >
            Release
          </button>
        </Placard>
      )}
      {merc && (
        <Placard
          tone="paper"
          title={`${merc.customName ?? merc.name} (${merc.class}) · ATK ${merc.attack} · DEF ${merc.defense} · ${merc.dailyCost} gold a day`}
        >
          <ResourceGlyph kind="mercenary" />
          <span className="hidden sm:inline">{merc.customName ?? merc.name}</span>
          {merc.hp != null && merc.maxHp != null && <span className="opacity-70">{merc.hp}/{merc.maxHp}</span>}
        </Placard>
      )}
      {(character?.bounty ?? 0) > 0 && (
        <Placard tone="danger" title="A price on your head. Pay it at a town or outrun it.">
          Bounty {character!.bounty}g
        </Placard>
      )}
    </>
  )
}
