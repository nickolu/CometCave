'use client'

import { useEffect, useState } from 'react'

import { calculateDay } from '@/app/tap-tap-adventure/lib/leveling'
import { CONQUERABLE_REGIONS } from '@/app/tap-tap-adventure/lib/mainQuestManager'
import { calculateSoulEssence } from '@/app/tap-tap-adventure/lib/soulEssenceCalculator'
import type { RunSummaryData } from '@/app/tap-tap-adventure/models/types'
import {
  BrassFigure,
  BrassPlate,
  PaperButton,
  PlaybillCaption,
  PlaybillRule,
  PlaybillSheet,
  PlaybillTitle,
  PrintingDots,
  Stamp,
} from '@/app/tap-tap-adventure/stage/Playbill'
import { ChunkyButton } from '@/components/ui/chunky-button'
import { useAuth } from '@/hooks/useAuth'
import { getTodayPST } from '@/lib/dates'
import { cn } from '@/lib/utils'

import AdventureLeaderboard from './AdventureLeaderboard'

function getStoredPlayerName(): string {
  try {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('adventure-player-name') ?? ''
  } catch {
    return ''
  }
}

function setStoredPlayerName(name: string): void {
  try {
    if (typeof window === 'undefined') return
    localStorage.setItem('adventure-player-name', name)
  } catch {
    // ignore
  }
}

interface RunSummaryProps {
  data: RunSummaryData
  onViewUpgrades: () => void
  onNewCharacter: () => void
  onBackToCharacters: () => void
}

/** One line of the receipt. */
function ReceiptRow({ label, value, tone }: { label: string; value: string; tone?: 'red' | 'green' | 'gold' }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 font-body text-sm text-ps-ink-soft">
      <span>{label}</span>
      <span
        className={cn(
          'tabular-nums text-ps-ink',
          tone === 'red' && 'text-ps-stamp-red',
          tone === 'green' && 'text-ps-stamp-green',
          tone === 'gold' && 'text-ps-stamp-gold'
        )}
      >
        {value}
      </span>
    </div>
  )
}

function EssenceBreakdown({ character, isVictory, essenceEarned }: { character: RunSummaryData['character']; isVictory?: boolean; essenceEarned?: number }) {
  const baseEssence = Math.floor(character.distance / 10)
  const levelBonus = character.level * 5
  const subtotal = baseEssence + levelBonus

  const deathPenaltyMultiplier = Math.max(0.5, 1 - character.deathCount * 0.1)

  const diffMultipliers: Record<string, number> = {
    casual: 0.5,
    normal: 1,
    hard: 1.5,
    ironman: 2.5,
  }
  const diffMultiplier = diffMultipliers[character.difficultyMode ?? 'normal'] ?? 1
  const diffLabel =
    character.difficultyMode
      ? character.difficultyMode.charAt(0).toUpperCase() + character.difficultyMode.slice(1)
      : 'Normal'

  const displayTotal = isVictory && essenceEarned !== undefined ? essenceEarned : calculateSoulEssence(character)

  return (
    <div className="divide-y divide-dotted divide-ps-ink/40" aria-label={`Soul essence receipt, subtotal ${subtotal}`}>
      <ReceiptRow label="Base (distance / 10)" value={`+${baseEssence}`} />
      <ReceiptRow label="Level bonus (level x 5)" value={`+${levelBonus}`} />
      {character.deathCount > 0 && (
        <ReceiptRow label={`Death penalty (${character.deathCount} deaths)`} value={`x${deathPenaltyMultiplier.toFixed(1)}`} tone="red" />
      )}
      {diffMultiplier !== 1 && (
        <ReceiptRow label={`${diffLabel} difficulty`} value={`x${diffMultiplier}`} tone={diffMultiplier > 1 ? 'green' : 'red'} />
      )}
      {isVictory && <ReceiptRow label="Victory bonus" value="x5" tone="gold" />}
      <div className="flex items-baseline justify-between gap-3 border-t-2 border-ps-ink pt-2 font-playbill text-lg uppercase tracking-wide text-ps-ink">
        <span>Total</span>
        <span className="tabular-nums">{displayTotal}</span>
      </div>
    </div>
  )
}

export default function RunSummary({
  data,
  onViewUpgrades,
  onNewCharacter,
  onBackToCharacters,
}: RunSummaryProps) {
  const { character, reason, essenceEarned, heirloom, killedBy } = data

  const { user } = useAuth()

  const [playerName, setPlayerName] = useState<string>('')
  const [nameInput, setNameInput] = useState<string>('')
  const [showNameInput, setShowNameInput] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  // Load player name from localStorage on mount
  useEffect(() => {
    const stored = getStoredPlayerName()
    setPlayerName(stored)
    setNameInput(stored)
    if (!stored) {
      setShowNameInput(true)
    }
  }, [])

  const handleSaveName = () => {
    const trimmed = nameInput.trim()
    if (trimmed.length > 0 && trimmed.length <= 20) {
      setStoredPlayerName(trimmed)
      setPlayerName(trimmed)
      setShowNameInput(false)
    }
  }

  const handleSubmitScore = async () => {
    if (!playerName || submitStatus === 'submitting') return
    setSubmitStatus('submitting')
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (user) {
        const token = await user.getIdToken()
        headers['Authorization'] = `Bearer ${token}`
      }
      const res = await fetch('/api/v1/tap-tap-adventure/leaderboard/submit-score', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          playerName,
          characterId: character.id,
          characterName: character.name,
          characterClass: character.class,
          distance: character.distance,
          level: character.level,
          gold: character.gold,
          regionsConquered: character.visitedRegions?.filter(r => CONQUERABLE_REGIONS.includes(r)).length ?? 0,
          date: getTodayPST(),
        }),
      })
      if (!res.ok) throw new Error('Failed to submit')
      setSubmitStatus('success')
    } catch {
      setSubmitStatus('error')
    }
  }

  const isRetirement = reason === 'retirement'
  const isVictory = reason === 'victory'
  const headerText = isVictory ? 'A triumph' : isRetirement ? 'A bow' : 'The curtain falls'

  const regionsConquered = character.visitedRegions?.filter(r => CONQUERABLE_REGIONS.includes(r)).length ?? 0

  const daysSurvived = calculateDay(character.distance)
  const diffLabel = character.difficultyMode
    ? character.difficultyMode.charAt(0).toUpperCase() + character.difficultyMode.slice(1)
    : 'Normal'

  // Count combat victories from story events if available (not tracked here, show N/A)
  // We don't have storyEvents in the summary data, so we skip enemies defeated

  // Leaderboard overlay
  if (showLeaderboard) {
    return (
      <div className="ps-scroll fixed inset-0 z-50 overflow-y-auto bg-ps-house p-4" role="dialog" aria-modal="true" aria-label="Leaderboard">
        <AdventureLeaderboard onBack={() => setShowLeaderboard(false)} />
      </div>
    )
  }

  return (
    <PlaybillSheet as="article" className="ps-print-in mx-auto w-full max-w-2xl px-4 pb-5 pt-5 sm:px-8 sm:pb-6" aria-label="The final bill">
      {/* The result, large */}
      <div className="text-center">
        <PlaybillCaption>The final bill</PlaybillCaption>
        <PlaybillTitle size="lg" className="mt-2">
          {headerText}
        </PlaybillTitle>
        <p className="mt-3 font-playbill text-xl uppercase leading-tight tracking-wide text-ps-ink">{character.name}</p>
        <PlaybillCaption className="mt-1">
          Level {character.level} · {character.race} · {character.class}
        </PlaybillCaption>
        {reason === 'victory' && (
          <p className="mt-3 font-body text-base italic leading-relaxed text-ps-ink">You have united all lands under your banner.</p>
        )}
        {killedBy && (reason === 'death' || reason === 'permadeath') && (
          <p className="mt-3 font-body text-base italic leading-relaxed text-ps-ink">
            Slain by <span className="font-medium not-italic">{killedBy}</span>.
          </p>
        )}
        {reason === 'retirement' && (
          <p className="mt-3 font-body text-base italic leading-relaxed text-ps-ink">Retired from the road.</p>
        )}
        {reason === 'permadeath' && (
          <div className="mt-3 flex flex-col items-center gap-1.5">
            <Stamp tone="red" animate className="text-xs">Gone for good</Stamp>
            <p className="font-body text-xs italic text-ps-stamp-red">This character is gone forever.</p>
          </div>
        )}
      </div>

      {/* The figures */}
      <section className="mt-5" aria-label="Run statistics">
        <BrassPlate className="grid grid-cols-3 divide-x-2 divide-ps-brass-deep/60 sm:grid-cols-5">
          <BrassFigure label="Distance" value={character.distance.toLocaleString()} sub="km" />
          <BrassFigure label="Level" value={character.level} />
          <BrassFigure label="Days" value={daysSurvived} />
          <BrassFigure label="Gold" value={character.gold.toLocaleString()} className="border-t-2 border-ps-brass-deep/60 sm:border-t-0" />
          <BrassFigure
            label="Deaths"
            value={character.deathCount}
            className="border-t-2 border-ps-brass-deep/60 sm:border-t-0"
          />
        </BrassPlate>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <Stamp tone={diffLabel === 'Casual' ? 'green' : diffLabel === 'Normal' ? 'ink' : 'red'} tilt={false}>
            {diffLabel}
          </Stamp>
          <Stamp tone={regionsConquered >= 14 ? 'gold' : 'ink'} tilt={false}>
            {regionsConquered} {regionsConquered === 1 ? 'region' : 'regions'} conquered
          </Stamp>
        </div>
      </section>

      <PlaybillRule className="my-5" />

      {/* Soul essence receipt */}
      <section aria-label="Soul essence earned">
        <PlaybillTitle size="sm">Soul essence earned</PlaybillTitle>
        <p className="mt-3 text-center font-playbill text-5xl leading-none tabular-nums text-ps-ink sm:text-6xl">{essenceEarned}</p>
        <PlaybillCaption className="mt-1 text-center">Soul essence</PlaybillCaption>
        <div className="mt-4">
          <EssenceBreakdown character={character} isVictory={isVictory} essenceEarned={essenceEarned} />
        </div>
      </section>

      {/* Heirloom */}
      {heirloom && (
        <section className="mt-5 rounded-[3px] border-2 border-ps-stamp-violet px-4 py-3" aria-label="Heirloom">
          <div className="flex flex-wrap items-center gap-2">
            <Stamp tone="violet" animate>Heirloom</Stamp>
            {heirloom.type && (
              <Stamp tone="violet" tilt={false}>
                {heirloom.type === 'equipment' ? 'Equipment' : heirloom.type === 'spell_scroll' ? 'Spell scroll' : 'Item'}
              </Stamp>
            )}
          </div>
          <p className="mt-2 font-playbill text-base uppercase tracking-wide text-ps-ink">{heirloom.name}</p>
          <p className="mt-1 font-body text-sm leading-snug text-ps-ink">{heirloom.description}</p>
          <p className="mt-1.5 font-body text-xs italic text-ps-ink-soft">This item will be available for your next character.</p>
        </section>
      )}

      <PlaybillRule className="my-5" />

      {/* Leaderboard */}
      <section aria-label="Leaderboard">
        <PlaybillTitle size="sm">Leaderboard</PlaybillTitle>

        {showNameInput ? (
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value.slice(0, 20))}
              placeholder="Your player name"
              aria-label="Player name"
              className="h-10 min-w-0 flex-1 rounded-[3px] border-2 border-ps-ink bg-transparent px-3 font-body text-base text-ps-ink placeholder:text-ps-ink-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
              onKeyDown={e => { if (e.key === 'Enter') handleSaveName() }}
            />
            <PaperButton onClick={handleSaveName} disabled={nameInput.trim().length === 0}>
              Save
            </PaperButton>
          </div>
        ) : (
          <p className="mt-3 font-body text-sm text-ps-ink-soft">
            Submitting as{' '}
            <button
              type="button"
              onClick={() => { setNameInput(playerName); setShowNameInput(true) }}
              className="rounded-[2px] font-medium text-ps-ink underline decoration-dotted underline-offset-2 hover:decoration-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
            >
              {playerName}
            </button>
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {submitStatus === 'idle' && (
            <PaperButton variant="brass" onClick={handleSubmitScore} disabled={!playerName || showNameInput}>
              Submit score
            </PaperButton>
          )}
          {submitStatus === 'submitting' && (
            <span className="inline-flex h-10 items-center px-2">
              <PrintingDots label="Submitting" />
            </span>
          )}
          {submitStatus === 'success' && (
            <Stamp tone="green" animate className="text-xs" role="status">Score submitted</Stamp>
          )}
          {submitStatus === 'error' && (
            <PaperButton variant="danger" onClick={handleSubmitScore}>
              Failed — try again
            </PaperButton>
          )}
          <PaperButton variant="outline" onClick={() => setShowLeaderboard(true)}>
            View leaderboard
          </PaperButton>
        </div>
      </section>

      <PlaybillRule className="my-5" />

      {/* Next action */}
      <div className="grid gap-2">
        {isVictory && (
          <PaperButton variant="outline" onClick={onBackToCharacters} className="w-full">
            Continue playing (post-game)
          </PaperButton>
        )}
        <ChunkyButton variant="primary" size="lg" onClick={onNewCharacter} className="w-full">
          New character
        </ChunkyButton>
        <div className="grid gap-2 sm:grid-cols-2">
          <PaperButton variant="outline" onClick={onViewUpgrades} className="w-full">
            View upgrades
          </PaperButton>
          {!isVictory && (
            <PaperButton variant="outline" onClick={onBackToCharacters} className="w-full">
              Back to characters
            </PaperButton>
          )}
        </div>
      </div>
    </PlaybillSheet>
  )
}
