'use client'

import { useState, useEffect } from 'react'
import type { AdventureScoreEntry, LeaderboardCategory, LeaderboardPeriod } from '@/app/tap-tap-adventure/lib/adventureLeaderboardStore'

interface AdventureLeaderboardProps {
  onBack: () => void
}

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

const PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  daily: 'Today',
  weekly: 'This Week',
  alltime: 'All-Time',
}

const CATEGORY_LABELS: Record<LeaderboardCategory, string> = {
  distance: 'Distance',
  level: 'Level',
  gold: 'Gold',
  regionsConquered: 'Regions',
}

export default function AdventureLeaderboard({ onBack }: AdventureLeaderboardProps) {
  const [period, setPeriod] = useState<LeaderboardPeriod>('daily')
  const [category, setCategory] = useState<LeaderboardCategory>('distance')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<{ period: string; category: string; entries: AdventureScoreEntry[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [playerName, setPlayerName] = useState<string>('')
  const [showNameDialog, setShowNameDialog] = useState(false)
  const [nameInput, setNameInput] = useState('')

  // Load player name from localStorage on mount
  useEffect(() => {
    const stored = getStoredPlayerName()
    setPlayerName(stored)
    if (!stored) {
      setShowNameDialog(true)
    }
  }, [])

  // Fetch leaderboard when period or category changes
  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/v1/tap-tap-adventure/leaderboard?period=${period}&category=${category}`
        )
        if (!res.ok) throw new Error('Failed to load leaderboard')
        const json = await res.json()
        setData(json)
      } catch {
        setError('Failed to load leaderboard.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [period, category])

  const handleSaveName = () => {
    const trimmed = nameInput.trim()
    if (trimmed.length > 0 && trimmed.length <= 20) {
      setStoredPlayerName(trimmed)
      setPlayerName(trimmed)
      setShowNameDialog(false)
    }
  }

  const currentNameLower = playerName.toLowerCase().trim()

  const renderPrimary = (entry: AdventureScoreEntry): string => {
    switch (category) {
      case 'distance':
        return `${entry.distance.toLocaleString()} km`
      case 'level':
        return `Lv ${entry.level}`
      case 'gold':
        return `${entry.gold.toLocaleString()} gp`
      case 'regionsConquered':
        return `${entry.regionsConquered} regions`
    }
  }

  const renderSecondary = (entry: AdventureScoreEntry): string => {
    switch (category) {
      case 'distance':
        return `Lv ${entry.level} ${entry.characterClass}`
      case 'level':
        return `${entry.distance.toLocaleString()} km`
      case 'gold':
        return `Lv ${entry.level} ${entry.characterClass}`
      case 'regionsConquered':
        return entry.characterName
    }
  }

  const renderEntries = () => {
    if (!data || !data.entries) return null

    if (data.entries.length === 0) {
      return (
        <div className="text-center text-slate-400 py-8">
          No scores yet. Be the first!
        </div>
      )
    }

    return data.entries.map((entry, i) => {
      const isCurrentUser =
        entry.playerName.toLowerCase().trim() === currentNameLower && currentNameLower !== ''
      return (
        <LeaderboardRow
          key={`${entry.playerName}-${entry.characterId}-${i}`}
          rank={i + 1}
          name={entry.playerName}
          primary={renderPrimary(entry)}
          secondary={renderSecondary(entry)}
          isCurrentUser={isCurrentUser}
        />
      )
    })
  }

  return (
    <div className="w-full mx-auto p-4 sm:p-6 bg-[#1a1b2e] min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={onBack}
          className="text-slate-400 hover:text-slate-200 text-sm px-3 py-1.5 rounded border border-[#3a3c56] hover:border-slate-500 transition-colors"
        >
          &larr; Back
        </button>
        <h2 className="text-2xl font-bold text-amber-400">Leaderboard</h2>
        <div className="w-16" />
      </div>

      {/* Player name display */}
      <div className="text-center mb-4">
        {playerName ? (
          <p className="text-slate-400 text-sm">
            Playing as{' '}
            <button
              type="button"
              onClick={() => { setNameInput(playerName); setShowNameDialog(true) }}
              className="text-amber-400 hover:underline"
            >
              {playerName}
            </button>
          </p>
        ) : (
          <p className="text-slate-400 text-sm">
            <button
              type="button"
              onClick={() => { setNameInput(''); setShowNameDialog(true) }}
              className="text-amber-400 hover:underline"
            >
              Set your player name
            </button>{' '}
            to appear on the leaderboard
          </p>
        )}
      </div>

      {/* Period tabs */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {(['daily', 'weekly', 'alltime'] as LeaderboardPeriod[]).map(p => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`py-2 px-3 rounded text-sm font-medium transition-colors ${
              period === p
                ? 'bg-indigo-600/30 border border-indigo-500/50 text-indigo-300'
                : 'bg-[#161723] border border-[#3a3c56] text-slate-400 hover:text-slate-200 hover:border-slate-500'
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Category tabs */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {(['distance', 'level', 'gold', 'regionsConquered'] as LeaderboardCategory[]).map(c => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`py-1.5 px-2 rounded text-xs font-medium transition-colors ${
              category === c
                ? 'bg-amber-600/20 border border-amber-500/40 text-amber-300'
                : 'bg-[#161723] border border-[#3a3c56] text-slate-400 hover:text-slate-200 hover:border-slate-500'
            }`}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      {/* Entries */}
      <div className="bg-[#161723] border border-[#3a3c56] rounded-lg p-3">
        {loading ? (
          <div className="text-center text-slate-400 py-8">Loading...</div>
        ) : error ? (
          <div className="text-center text-red-400 py-8">{error}</div>
        ) : (
          <div className="flex flex-col gap-1.5">{renderEntries()}</div>
        )}
      </div>

      {/* Name dialog */}
      {showNameDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md bg-[#1a1b2e] border border-[#3a3c56] rounded-lg p-6 flex flex-col gap-4">
            <h3 className="text-xl font-bold text-amber-400 text-center">
              {playerName ? 'Change Player Name' : 'Set Player Name'}
            </h3>
            <p className="text-slate-400 text-sm text-center">
              This name will appear on the leaderboard (1-20 characters).
            </p>
            <input
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value.slice(0, 20))}
              placeholder="Your player name"
              className="w-full px-3 py-2 rounded bg-[#161723] border border-[#3a3c56] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              onKeyDown={e => { if (e.key === 'Enter') handleSaveName() }}
              autoFocus
            />
            <div className="flex gap-2">
              {playerName && (
                <button
                  type="button"
                  onClick={() => setShowNameDialog(false)}
                  className="flex-1 py-2 px-4 rounded bg-slate-700/30 border border-slate-600/40 text-slate-300 hover:bg-slate-700/50 transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={handleSaveName}
                disabled={nameInput.trim().length === 0}
                className="flex-1 py-2 px-4 rounded bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 font-semibold hover:bg-indigo-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function LeaderboardRow({
  rank,
  name,
  primary,
  secondary,
  isCurrentUser,
}: {
  rank: number
  name: string
  primary: string
  secondary: string
  isCurrentUser: boolean
}) {
  const rankEmoji = rank === 1 ? '\uD83E\uDD47' : rank === 2 ? '\uD83E\uDD48' : rank === 3 ? '\uD83E\uDD49' : null

  return (
    <div
      className={`flex items-center justify-between py-2.5 px-3 rounded ${
        isCurrentUser
          ? 'bg-amber-600/15 border border-amber-500/30'
          : 'bg-[#1a1b2e]'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex items-center justify-center w-8 shrink-0">
          {rankEmoji ? (
            <span className="text-xl">{rankEmoji}</span>
          ) : (
            <span className="text-slate-500 text-sm font-mono">#{rank}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className={`font-medium truncate ${isCurrentUser ? 'text-amber-400' : 'text-slate-200'}`}>
            {name}
            {isCurrentUser && <span className="text-xs ml-2 text-amber-400/60">(you)</span>}
          </div>
          <div className="text-slate-500 text-xs">{secondary}</div>
        </div>
      </div>
      <div className={`font-bold text-right shrink-0 ml-2 ${isCurrentUser ? 'text-amber-400' : 'text-slate-200'}`}>
        {primary}
      </div>
    </div>
  )
}
