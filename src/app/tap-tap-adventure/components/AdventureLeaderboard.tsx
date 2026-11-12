'use client'

/**
 * The ranks: a ledger of other players' runs, fetched from the server. Your
 * own row is stamped. The name you appear under is set in a small dialog.
 */
import { useEffect, useRef, useState } from 'react'

import type { AdventureScoreEntry, LeaderboardCategory, LeaderboardPeriod } from '@/app/tap-tap-adventure/lib/adventureLeaderboardStore'
import { useDialogFocus } from '@/app/tap-tap-adventure/lib/useDialogFocus'
import { PaperButton, PlaybillCaption, PlaybillSheet, PlaybillTitle, PrintingDots, Stamp } from '@/app/tap-tap-adventure/stage/Playbill'
import { cn } from '@/lib/utils'

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
  weekly: 'This week',
  alltime: 'All time',
}

const CATEGORY_LABELS: Record<LeaderboardCategory, string> = {
  distance: 'Distance',
  level: 'Level',
  gold: 'Gold',
  regionsConquered: 'Regions',
}

const INPUT_CLASS =
  'h-10 w-full rounded-[3px] border-2 border-ps-ink bg-transparent px-3 font-body text-base text-ps-ink placeholder:text-ps-ink-faint focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary'

export default function AdventureLeaderboard({ onBack }: AdventureLeaderboardProps) {
  const [period, setPeriod] = useState<LeaderboardPeriod>('daily')
  const [category, setCategory] = useState<LeaderboardCategory>('distance')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<{ period: string; category: string; entries: AdventureScoreEntry[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [playerName, setPlayerName] = useState<string>('')
  const [showNameDialog, setShowNameDialog] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  useDialogFocus(dialogRef)

  // Load player name from localStorage on mount
  useEffect(() => {
    const stored = getStoredPlayerName()
    setPlayerName(stored)
    if (!stored) {
      setShowNameDialog(true)
    }
  }, [])

  // Fetch leaderboard when period or category changes (or the player asks again)
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/v1/tap-tap-adventure/leaderboard?period=${period}&category=${category}`,
          { signal: controller.signal }
        )
        if (!res.ok) throw new Error('Failed to load leaderboard')
        const json = await res.json()
        setData(json)
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
        setError('The ranks could not be fetched.')
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => controller.abort()
  }, [period, category, reloadKey])

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
        return `${entry.gold.toLocaleString()} gold`
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
        <p className="py-6 text-center font-body text-sm italic text-ps-ink-soft">
          No one is on the board yet. Walk and you will be the first name on it.
        </p>
      )
    }

    return (
      <ol className="divide-y divide-ps-playbill-edge border-y border-ps-playbill-edge" aria-label={`${PERIOD_LABELS[period]} by ${CATEGORY_LABELS[category].toLowerCase()}`}>
        {data.entries.map((entry, i) => {
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
        })}
      </ol>
    )
  }

  return (
    <section aria-label="Ranks" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <PaperButton size="sm" variant="outline" onClick={onBack}>
          Back
        </PaperButton>
        <PaperButton size="sm" variant="outline" onClick={() => setReloadKey(k => k + 1)} disabled={loading}>
          Refresh
        </PaperButton>
      </div>
      <PlaybillTitle size="sm">Ranks</PlaybillTitle>

      <p className="text-center font-body text-sm text-ps-ink-soft">
        {playerName ? (
          <>
            Entered as{' '}
            <button
              type="button"
              onClick={() => { setNameInput(playerName); setShowNameDialog(true) }}
              className="rounded-[2px] font-semibold text-ps-ink underline decoration-ps-ink-faint underline-offset-2 hover:decoration-ps-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
            >
              {playerName}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => { setNameInput(''); setShowNameDialog(true) }}
              className="rounded-[2px] font-semibold text-ps-ink underline decoration-ps-ink-faint underline-offset-2 hover:decoration-ps-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
            >
              Set your name
            </button>{' '}
            to be entered on the board
          </>
        )}
      </p>

      <div className="grid grid-cols-3 gap-1" role="group" aria-label="Period">
        {(['daily', 'weekly', 'alltime'] as LeaderboardPeriod[]).map(p => (
          <PaperButton key={p} size="sm" variant={period === p ? 'ink' : 'outline'} aria-pressed={period === p} onClick={() => setPeriod(p)}>
            {PERIOD_LABELS[p]}
          </PaperButton>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1" role="group" aria-label="Ranked by">
        {(['distance', 'level', 'gold', 'regionsConquered'] as LeaderboardCategory[]).map(c => (
          <PaperButton key={c} size="sm" variant={category === c ? 'ink' : 'outline'} aria-pressed={category === c} onClick={() => setCategory(c)} className="px-1">
            {CATEGORY_LABELS[c]}
          </PaperButton>
        ))}
      </div>

      <div aria-live="polite">
        {loading ? (
          <div className="flex justify-center py-6">
            <PrintingDots label="Fetching the ranks" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-5 text-center">
            <Stamp tone="red">Not fetched</Stamp>
            <p className="font-body text-sm text-ps-ink">{error}</p>
            <p className="font-body text-xs text-ps-ink-soft">Check your connection and ask again.</p>
            <PaperButton size="sm" variant="outline" onClick={() => setReloadKey(k => k + 1)}>
              Try again
            </PaperButton>
          </div>
        ) : (
          renderEntries()
        )}
      </div>

      {showNameDialog && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Set player name"
          className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "color-mix(in srgb, var(--ps-house) 70%, transparent)" }}
          onKeyDown={e => {
            if (e.key === 'Escape' && playerName) setShowNameDialog(false)
          }}
        >
          <PlaybillSheet className="w-full max-w-md">
            <div className="flex flex-col gap-4 px-5 pb-5 pt-4">
              <PlaybillTitle size="md">{playerName ? 'Change your name' : 'Your name on the board'}</PlaybillTitle>
              <PlaybillCaption className="text-center">1 to 20 characters · shown to other players</PlaybillCaption>
              <input
                type="text"
                value={nameInput}
                onChange={e => setNameInput(e.target.value.slice(0, 20))}
                placeholder="Your name"
                aria-label="Your player name"
                className={INPUT_CLASS}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveName() }}
                autoFocus
              />
              <div className="flex gap-2">
                {playerName && (
                  <PaperButton variant="outline" className="flex-1" onClick={() => setShowNameDialog(false)}>
                    Cancel
                  </PaperButton>
                )}
                <PaperButton className="flex-1" onClick={handleSaveName} disabled={nameInput.trim().length === 0}>
                  Save
                </PaperButton>
              </div>
            </div>
          </PlaybillSheet>
        </div>
      )}
    </section>
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
  return (
    <li
      className={cn('flex items-center gap-3 py-2 pl-1 pr-2', isCurrentUser && 'bg-ps-playbill-shade')}
      aria-current={isCurrentUser ? 'true' : undefined}
    >
      <span
        className={cn('w-7 shrink-0 text-right font-playbill text-base tabular-nums leading-none', rank <= 3 ? 'text-ps-stamp-gold' : 'text-ps-ink-soft')}
        aria-label={`Rank ${rank}`}
      >
        {rank}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-body text-sm font-semibold text-ps-ink">{name}</span>
          {isCurrentUser && <Stamp tone="red">You</Stamp>}
        </span>
        <span className="block font-body text-xs text-ps-ink-soft">{secondary}</span>
      </span>
      <span className="shrink-0 font-playbill text-base tabular-nums text-ps-ink">{primary}</span>
    </li>
  )
}
