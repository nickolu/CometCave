'use client'

import { useState, useEffect } from 'react'
import { calculateDay } from '@/app/tap-tap-adventure/lib/leveling'
import { calculateSoulEssence } from '@/app/tap-tap-adventure/lib/soulEssenceCalculator'
import { CONQUERABLE_REGIONS } from '@/app/tap-tap-adventure/lib/mainQuestManager'
import type { RunSummaryData } from '@/app/tap-tap-adventure/models/types'
import { getTodayPST } from '@/app/trivia/lib/triviaUtils'
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
    <div className="space-y-1 text-sm text-slate-400">
      <div className="flex justify-between">
        <span>Base (distance / 10)</span>
        <span className="text-amber-300">+{baseEssence}</span>
      </div>
      <div className="flex justify-between">
        <span>Level bonus (level x 5)</span>
        <span className="text-amber-300">+{levelBonus}</span>
      </div>
      {character.deathCount > 0 && (
        <div className="flex justify-between">
          <span>Death penalty ({character.deathCount} deaths)</span>
          <span className="text-red-400">x{deathPenaltyMultiplier.toFixed(1)}</span>
        </div>
      )}
      {diffMultiplier !== 1 && (
        <div className="flex justify-between">
          <span>{diffLabel} difficulty</span>
          <span className={diffMultiplier > 1 ? 'text-green-400' : 'text-red-400'}>
            x{diffMultiplier}
          </span>
        </div>
      )}
      {isVictory && (
        <div className="flex justify-between">
          <span>Victory bonus</span>
          <span className="text-yellow-400">x5</span>
        </div>
      )}
      <div className="flex justify-between border-t border-slate-700 pt-1 font-semibold text-amber-400">
        <span>Total</span>
        <span>{displayTotal}</span>
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
      const res = await fetch('/api/v1/tap-tap-adventure/leaderboard/submit-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
  const headerText = isVictory ? 'World Conquered!' : isRetirement ? 'Run Complete' : 'Fallen in Battle'
  const headerColor = isVictory
    ? 'text-yellow-300'
    : isRetirement
      ? 'text-purple-300'
      : 'text-red-400'
  const headerBorder = isVictory
    ? 'border-yellow-500/30'
    : isRetirement
      ? 'border-purple-500/30'
      : 'border-red-500/30'

  const regionsConquered = character.visitedRegions?.filter(r => CONQUERABLE_REGIONS.includes(r)).length ?? 0

  const daysSurvived = calculateDay(character.distance)

  // Count combat victories from story events if available (not tracked here, show N/A)
  // We don't have storyEvents in the summary data, so we skip enemies defeated

  // Leaderboard overlay
  if (showLeaderboard) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-[#1a1b2e] p-4">
        <AdventureLeaderboard onBack={() => setShowLeaderboard(false)} />
      </div>
    )
  }

  return (
    <div className="w-full mx-auto p-4 sm:p-6 bg-[#1a1b2e] border border-[#3a3c56] rounded-lg mt-6 max-w-2xl">
      {/* Header */}
      <div className={`text-center pb-4 mb-6 border-b ${headerBorder}`}>
        <h2 className={`text-3xl sm:text-4xl font-bold ${headerColor}`}>
          {headerText}
        </h2>
        <p className="text-slate-400 mt-2 text-lg">
          {character.name} &mdash; Level {character.level} {character.race} {character.class}
        </p>
        {reason === 'victory' && (
          <p className="text-yellow-400 mt-2 font-semibold">You have united all lands under your banner.</p>
        )}
        {killedBy && (reason === 'death' || reason === 'permadeath') && (
          <p className="text-slate-300 mt-2">Slain by <span className="font-semibold text-red-300">{killedBy}</span></p>
        )}
        {reason === 'permadeath' && (
          <p className="text-red-500 text-sm mt-1 italic">This character is gone forever.</p>
        )}
      </div>

      {/* Run Stats Grid */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Run Statistics
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Distance" value={character.distance.toLocaleString()} sublabel="km" />
          <StatCard label="Level" value={String(character.level)} />
          <StatCard label="Days Survived" value={String(daysSurvived)} />
          <StatCard label="Gold" value={character.gold.toLocaleString()} />
          <StatCard
            label="Deaths"
            value={String(character.deathCount)}
            highlight={character.deathCount === 0 ? 'green' : undefined}
          />
          <StatCard
            label="Difficulty"
            value={
              character.difficultyMode
                ? character.difficultyMode.charAt(0).toUpperCase() +
                  character.difficultyMode.slice(1)
                : 'Normal'
            }
          />
          <StatCard
            label="Regions Conquered"
            value={String(regionsConquered)}
            highlight={regionsConquered >= 14 ? 'green' : undefined}
          />
        </div>
      </div>

      {/* Leaderboard Section */}
      <div className="mb-6 p-4 bg-indigo-950/30 border border-indigo-600/30 rounded-lg">
        <h3 className="text-sm font-semibold text-indigo-400 uppercase tracking-wider mb-3">
          Submit to Leaderboard
        </h3>

        {/* Player name input */}
        {showNameInput ? (
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value.slice(0, 20))}
              placeholder="Enter your player name"
              className="flex-1 px-3 py-2 rounded bg-[#161723] border border-[#3a3c56] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
              onKeyDown={e => { if (e.key === 'Enter') handleSaveName() }}
            />
            <button
              type="button"
              onClick={handleSaveName}
              disabled={nameInput.trim().length === 0}
              className="px-3 py-2 rounded bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 text-sm font-medium hover:bg-indigo-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save
            </button>
          </div>
        ) : (
          <p className="text-slate-400 text-sm mb-3">
            Submitting as{' '}
            <button
              type="button"
              onClick={() => { setNameInput(playerName); setShowNameInput(true) }}
              className="text-indigo-400 hover:underline"
            >
              {playerName}
            </button>
          </p>
        )}

        {/* Submit button / status */}
        <div className="flex gap-2 flex-wrap">
          {submitStatus === 'idle' && (
            <button
              type="button"
              onClick={handleSubmitScore}
              disabled={!playerName || showNameInput}
              className="py-2 px-4 rounded bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 text-sm font-semibold hover:bg-indigo-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit Score
            </button>
          )}
          {submitStatus === 'submitting' && (
            <span className="py-2 px-4 text-slate-400 text-sm">Submitting...</span>
          )}
          {submitStatus === 'success' && (
            <span className="py-2 px-1 text-green-400 text-sm">Score submitted!</span>
          )}
          {submitStatus === 'error' && (
            <button
              type="button"
              onClick={handleSubmitScore}
              className="py-2 px-4 rounded bg-red-600/20 border border-red-500/40 text-red-300 text-sm font-semibold hover:bg-red-600/30 transition-colors"
            >
              Failed — Retry?
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowLeaderboard(true)}
            className="py-2 px-4 rounded bg-[#161723] border border-[#3a3c56] text-slate-300 text-sm hover:border-slate-500 hover:text-slate-100 transition-colors"
          >
            View Leaderboard
          </button>
        </div>
      </div>

      {/* Soul Essence Section */}
      <div className="mb-6 p-4 bg-amber-950/30 border border-amber-600/30 rounded-lg">
        <h3 className="text-sm font-semibold text-amber-500 uppercase tracking-wider mb-3">
          Soul Essence Earned
        </h3>
        <div className="text-center mb-4">
          <span className="text-5xl sm:text-6xl font-bold text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.4)]">
            {essenceEarned}
          </span>
          <p className="text-amber-500/70 text-sm mt-1">Soul Essence</p>
        </div>
        <EssenceBreakdown character={character} isVictory={isVictory} essenceEarned={essenceEarned} />
      </div>

      {/* Heirloom Section */}
      {heirloom && (
        <div className="mb-6 p-4 bg-purple-950/30 border border-purple-600/30 rounded-lg">
          <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-2">
            Heirloom Generated
          </h3>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded bg-purple-800/40 border border-purple-500/30 flex items-center justify-center text-lg shrink-0">
              {heirloom.type === 'equipment' ? '\u2694' : heirloom.type === 'spell_scroll' ? '\u{1F4DC}' : '\u2728'}
            </div>
            <div>
              <p className="font-semibold text-purple-200">{heirloom.name}</p>
              <p className="text-sm text-slate-400 mt-0.5">{heirloom.description}</p>
              <p className="text-xs text-purple-400/70 mt-1 italic">
                This item will be available for your next character.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Call to Action Buttons */}
      <div className="space-y-3">
        {isVictory && (
          <button
            type="button"
            onClick={onBackToCharacters}
            className="w-full py-3 px-4 rounded-lg bg-yellow-600/20 border border-yellow-500/40 text-yellow-300 font-semibold text-lg hover:bg-yellow-600/30 transition-colors cursor-pointer"
          >
            Continue Playing (Post-Game)
          </button>
        )}
        <button
          type="button"
          onClick={onViewUpgrades}
          className="w-full py-3 px-4 rounded-lg bg-amber-600/20 border border-amber-500/40 text-amber-300 font-semibold text-lg hover:bg-amber-600/30 transition-colors cursor-pointer"
        >
          View Eternal Upgrades
        </button>
        <button
          type="button"
          onClick={onNewCharacter}
          className="w-full py-3 px-4 rounded-lg bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 font-semibold text-lg hover:bg-indigo-600/30 transition-colors cursor-pointer"
        >
          Create New Character
        </button>
        {!isVictory && (
          <button
            type="button"
            onClick={onBackToCharacters}
            className="w-full py-3 px-4 rounded-lg bg-slate-700/30 border border-slate-600/40 text-slate-300 font-semibold text-lg hover:bg-slate-700/50 transition-colors cursor-pointer"
          >
            Back to Characters
          </button>
        )}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  sublabel,
  highlight,
}: {
  label: string
  value: string
  sublabel?: string
  highlight?: 'green'
}) {
  return (
    <div className="bg-[#161723] border border-[#3a3c56] rounded-lg p-3 text-center">
      <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
      <p
        className={`text-xl font-bold mt-1 ${
          highlight === 'green' ? 'text-green-400' : 'text-slate-200'
        }`}
      >
        {value}
      </p>
      {sublabel && <p className="text-xs text-slate-500">{sublabel}</p>}
    </div>
  )
}
