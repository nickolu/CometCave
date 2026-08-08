'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

import { disableSound, enableSound } from '@/app/micro-land/audio/sound-engine'
import { THEMES } from '@/app/micro-land/domain/config/themes'
import { STEADY_SHOW_SECONDS } from '@/app/micro-land/domain/constants'
import { TUNING_DEFAULTS, type TuningKey } from '@/app/micro-land/domain/tuning'
import { formatDuration } from '@/app/micro-land/format'
import { type PopulationEntry, SUMMONED_THEME_ID, useMicroLand, type Tool } from '@/app/micro-land/store'
import { SparkleIcon } from '@/app/micro-land/components/sparkle-icon'
import { useAuth } from '@/hooks/useAuth'

// ---------------------------------------------------------------------------
// Ecosystem health
// ---------------------------------------------------------------------------

type HealthStatus = 'Thriving' | 'Stable' | 'Stressed' | 'Collapsing'

const HEALTH_COLOR: Record<HealthStatus, string> = {
  Thriving: '#22c55e',
  Stable: '#a3e635',
  Stressed: '#f97316',
  Collapsing: '#ef4444',
}

const HEALTH_TOOLTIP: Record<HealthStatus, string> = {
  Thriving: 'Many species, spread roughly even — the land supports itself.',
  Stable: 'Decent variety, no single kind overwhelming the rest.',
  Stressed: 'Few species or one kind crowding out the others.',
  Collapsing: 'Almost nothing alive, or only one kind left.',
}

function ecosystemHealth(population: PopulationEntry[], total: number): HealthStatus {
  const richness = population.length
  if (richness === 0 || total === 0) return 'Collapsing'
  if (richness === 1) return 'Stressed'

  // Shannon evenness: how evenly the population is distributed across species.
  let entropy = 0
  for (const p of population) {
    const pi = p.count / total
    if (pi > 0) entropy -= pi * Math.log(pi)
  }
  const evenness = entropy / Math.log(richness)

  if (richness >= 4 && evenness >= 0.65) return 'Thriving'
  if (richness >= 3 && evenness >= 0.45) return 'Stable'
  if (richness >= 2 || evenness >= 0.3) return 'Stressed'
  return 'Collapsing'
}

const SPEEDS = [
  { value: 0.5, label: '½×' },
  { value: 1, label: '1×' },
  { value: 3, label: '3×' },
]

const chipBase: React.CSSProperties = {
  fontFamily: 'var(--cc-font-mono)',
  fontSize: 10,
  letterSpacing: 1.4,
  textTransform: 'uppercase',
  borderRadius: 4,
  padding: '7px 10px',
  minHeight: 34,
  // Longhand rather than the `border` shorthand on purpose: the active and
  // tuned states below override borderColor alone, and React warns when a
  // longhand is dropped back out while a conflicting shorthand stays put.
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'var(--cc-mint-line)',
  background: 'transparent',
  color: 'var(--cc-text-muted)',
}

const activeChip: React.CSSProperties = {
  background: 'var(--cc-mint-soft)',
  borderColor: 'var(--cc-mint)',
  color: 'var(--cc-mint)',
}

/**
 * Three sliders, drawn on the same grid as everything else in the world.
 *
 * A gear would be the obvious icon and the wrong one: a gear means "app
 * settings", and this opens the numbers the ecosystem runs on. Sliders say what
 * is behind it.
 */
function SlidersIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor" aria-hidden="true">
      <rect x="0" y="2" width="13" height="1" />
      <rect x="3" y="0" width="3" height="5" />
      <rect x="0" y="6" width="13" height="1" />
      <rect x="8" y="4" width="3" height="5" />
      <rect x="0" y="10" width="13" height="1" />
      <rect x="1" y="8" width="3" height="5" />
    </svg>
  )
}

export function Hud({
  onReshuffle,
  onClearLife,
  onOpenHistory,
}: {
  onReshuffle: () => void
  onClearLife: () => void
  onOpenHistory: () => void
}) {
  const themeId = useMicroLand(s => s.themeId)
  const setTheme = useMicroLand(s => s.setTheme)
  const paused = useMicroLand(s => s.paused)
  const togglePaused = useMicroLand(s => s.togglePaused)
  const speed = useMicroLand(s => s.speed)
  const setSpeed = useMicroLand(s => s.setSpeed)
  const total = useMicroLand(s => s.totalCreatures)
  const population = useMicroLand(s => s.population)
  const setGuideOpen = useMicroLand(s => s.setGuideOpen)
  const summonedLand = useMicroLand(s => s.summonedLand)
  const steadySeconds = useMicroLand(s => s.records.steadySeconds)
  const elapsed = useMicroLand(s => s.elapsed)
  const setWorldsOpen = useMicroLand(s => s.setWorldsOpen)
  const activeWorldId = useMicroLand(s => s.shelf.activeId)
  const settingsOpen = useMicroLand(s => s.settingsOpen)
  const setSettingsOpen = useMicroLand(s => s.setSettingsOpen)
  const tuning = useMicroLand(s => s.tuning)
  const challengeActive = useMicroLand(s => s.challengeActive)
  const setChallengeActive = useMicroLand(s => s.setChallengeActive)
  const adaptiveRun = useMicroLand(s => s.adaptiveRun)
  const endAdaptiveRun = useMicroLand(s => s.endAdaptiveRun)

  const replaySnapshots = useMicroLand(s => s.replaySnapshots)
  const soundEnabled = useMicroLand(s => s.soundEnabled)
  const setSoundEnabled = useMicroLand(s => s.setSoundEnabled)

  const setHistoryOpen = useMicroLand(s => s.setHistoryOpen)
  const setSummonOpen = useMicroLand(s => s.setSummonOpen)
  const tool = useMicroLand(s => s.tool)
  const setTool = useMicroLand(s => s.setTool)
  const notify = useMicroLand(s => s.notify)
  const activeMaterials = useMicroLand(s => s.activeMaterials)

  const { user, loading: authLoading } = useAuth()
  const isSignedIn = !authLoading && !!user && !user.isAnonymous
  const authLabel = isSignedIn
    ? (user?.displayName || user?.email?.split('@')[0] || 'Account')
    : 'Log in'

  // A world running on numbers other than the shipped ones is worth saying out
  // loud — otherwise a land that behaves strangely months from now is a mystery
  // rather than a slider someone left pushed over.
  const tuned = (Object.keys(TUNING_DEFAULTS) as TuningKey[]).some(
    key => tuning[key] !== TUNING_DEFAULTS[key]
  )

  const species = population.length
  // Below the threshold this would flicker on and off through the early churn,
  // which reads as a broken counter rather than as a streak.
  const steady = steadySeconds >= STEADY_SHOW_SECONDS ? formatDuration(steadySeconds) : null

  const ageLabel =
    elapsed >= 3600 ? 'The Ancient Cave' :
    elapsed >= 1200 ? 'The Great Struggle' :
    elapsed >= 300  ? 'The Green Age' :
    'The Young Age'

  const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'] as const
  const seasonName =
    tuning.seasonAmplitude > 0 && tuning.seasonPeriod > 0
      ? SEASON_NAMES[Math.floor(((elapsed % tuning.seasonPeriod) / tuning.seasonPeriod) * 4) % 4]
      : null

  /** One in-world day = 60 sim seconds. Day 1 starts at t=0. */
  const dayNumber = Math.floor(elapsed / 60) + 1

  const [overflowOpen, setOverflowOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const overflowRef = useRef<HTMLDivElement>(null)

  // Close the overflow menu when clicking outside it.
  useEffect(() => {
    if (!overflowOpen) return
    const onDown = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [overflowOpen])

  // Shared style for items inside the overflow dropdown.
  const overflowItem: React.CSSProperties = {
    ...chipBase,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    textAlign: 'left',
  }

  return (
    <header
      className="flex items-center gap-2 px-3 py-2 pl-14"
      style={{
        borderBottom: '1px solid var(--cc-panel-divider)',
        background: 'linear-gradient(180deg, var(--cc-panel-grad-from), transparent)',
        overflow: 'hidden',
      }}
    >
      <h1
        className="hidden sm:block shrink-0"
        style={{
          fontFamily: 'var(--cc-font-mono)',
          fontSize: 12,
          letterSpacing: 3,
          textTransform: 'uppercase',
          color: 'var(--cc-mint)',
        }}
      >
        Micro&nbsp;Land
      </h1>

      {/* ── Primary one-click actions ──────────────────────────────────────── */}

      <button
        type="button"
        className="cc-btn shrink-0"
        onClick={() => setSummonOpen(true)}
        style={{
          ...chipBase,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          background: 'linear-gradient(135deg, var(--cc-mint-soft), rgba(100,220,200,0.05))',
          borderColor: 'var(--cc-mint)',
          color: 'var(--cc-mint)',
        }}
        title="Introduce a creature to this world"
      >
        <SparkleIcon size={10} />
        Generate
      </button>

      <button
        type="button"
        className="cc-btn shrink-0"
        onClick={() =>
          setTool(tool.kind === 'inspect' ? { kind: 'material', material: 'dirt' } : { kind: 'inspect' })
        }
        aria-pressed={tool.kind === 'inspect'}
        style={{
          ...chipBase,
          ...(tool.kind === 'inspect' ? activeChip : {}),
        }}
        title="Click any creature to inspect it"
      >
        Inspect
      </button>

      <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Speed">
        <button
          type="button"
          className="cc-btn"
          onClick={togglePaused}
          style={{ ...chipBase, ...(paused ? activeChip : {}) }}
          aria-pressed={paused}
        >
          {paused ? 'Paused' : 'Pause'}
        </button>
        {SPEEDS.map(option => (
          <button
            key={option.value}
            type="button"
            className="cc-btn"
            onClick={() => setSpeed(option.value)}
            style={{
              ...chipBase,
              padding: '7px 9px',
              ...(speed === option.value ? activeChip : {}),
            }}
            aria-pressed={speed === option.value}
            aria-label={`Speed ${option.label}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* ── Right side ────────────────────────────────────────────────────── */}

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {/* Challenge display — contextual, stays visible */}
        {challengeActive && (
          <>
            <span
              style={{
                fontFamily: 'var(--cc-font-mono)',
                fontSize: 9,
                letterSpacing: 1,
                color: 'var(--cc-mint)',
                opacity: 0.85,
                maxWidth: 200,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={challengeActive.goal}
            >
              {challengeActive.name}: {challengeActive.goal}
            </span>
            <button
              type="button"
              className="cc-btn"
              onClick={() => setChallengeActive(null)}
              title="End challenge"
              style={{
                fontFamily: 'var(--cc-font-mono)',
                fontSize: 9,
                padding: '2px 6px',
                border: '1px solid var(--cc-mint-line)',
                color: 'var(--cc-text-muted)',
              }}
            >
              ×
            </button>
          </>
        )}

        {/* Adaptive challenge HUD badge */}
        {(adaptiveRun.active || adaptiveRun.result === 'won') && (
          <>
            <span
              style={{
                fontFamily: 'var(--cc-font-mono)',
                fontSize: 9,
                letterSpacing: 1,
                color: adaptiveRun.result === 'won' ? 'var(--cc-gold)' : 'var(--cc-mint)',
                opacity: 0.9,
              }}
              title="Adaptive challenge: sustain this population to win"
            >
              {adaptiveRun.result === 'won'
                ? `Adaptive complete!`
                : `≥${adaptiveRun.targetPopulation} alive · ${Math.floor(adaptiveRun.sustainedSeconds)}/${adaptiveRun.sustainGoal}s`}
            </span>
            <button
              type="button"
              className="cc-btn"
              onClick={endAdaptiveRun}
              title="End adaptive challenge"
              style={{
                fontFamily: 'var(--cc-font-mono)',
                fontSize: 9,
                padding: '2px 6px',
                border: '1px solid var(--cc-mint-line)',
                color: 'var(--cc-text-muted)',
              }}
            >
              ×
            </button>
          </>
        )}

        {/* Field Guide — species count and streak */}
        <button
          type="button"
          className="cc-btn"
          onClick={() => setGuideOpen(true)}
          style={chipBase}
          title="Open the field guide"
        >
          {species} kinds · {total} alive
          {steady && (
            <>
              {' · '}
              <span style={{ color: 'var(--cc-gold)' }}>{steady} steady</span>
            </>
          )}
          {' · '}
          <span
            style={{
              color: ageLabel === 'The Young Age'
                ? 'var(--cc-text-muted)'
                : 'var(--cc-gold)',
            }}
          >
            {ageLabel}
          </span>
          {seasonName && (
            <>
              {' · '}
              <span style={{ color: 'var(--cc-text-muted)' }}>{seasonName}</span>
            </>
          )}
          {' · '}
          <span style={{ color: 'var(--cc-text-muted)' }}>Day {dayNumber}</span>
          {activeMaterials > 0 && (
            <>
              {' · '}
              <span style={{ color: 'var(--cc-text-muted)' }}>{activeMaterials} biomes</span>
            </>
          )}
        </button>

        {/* Ecosystem health — informational */}
        {(() => {
          const status = ecosystemHealth(population, total)
          return (
            <span
              title={HEALTH_TOOLTIP[status]}
              style={{
                ...chipBase,
                borderColor: HEALTH_COLOR[status],
                color: HEALTH_COLOR[status],
                cursor: 'default',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              {status}
            </span>
          )
        })()}

        {/* Auth — always accessible */}
        {!authLoading && (
          <Link
            href="/auth"
            style={{
              ...chipBase,
              padding: '7px 10px',
              ...(isSignedIn
                ? { color: 'var(--cc-text-default)' }
                : { color: 'var(--cc-mint)', borderColor: 'var(--cc-mint)' }),
            }}
            title={isSignedIn ? 'Account settings' : 'Sign in to save your progress across devices'}
          >
            {authLabel}
          </Link>
        )}

        {/* Overflow menu — secondary actions */}
        <div ref={overflowRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className="cc-btn"
            onClick={() => setOverflowOpen(v => !v)}
            aria-expanded={overflowOpen}
            aria-label="More options"
            title="More options"
            style={{
              ...chipBase,
              padding: '7px 10px',
              letterSpacing: 2,
              ...(overflowOpen ? activeChip : {}),
              ...(tuned && !overflowOpen
                ? { borderColor: 'var(--cc-gold)', color: 'var(--cc-gold)' }
                : {}),
            }}
          >
            ···
          </button>

          {overflowOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 4px)',
                minWidth: 200,
                background: 'var(--cc-modal-bg-to, #1b1b2e)',
                border: '1px solid var(--cc-panel-divider)',
                borderRadius: 6,
                zIndex: 50,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                padding: 6,
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}
            >
              {/* Theme selector */}
              <label className="sr-only" htmlFor="micro-land-theme-overflow">
                Choose a world
              </label>
              <select
                id="micro-land-theme-overflow"
                value={themeId}
                onChange={e => { setTheme(e.target.value); setOverflowOpen(false) }}
                style={{
                  ...overflowItem,
                  color: 'var(--cc-text-default)',
                  background: 'var(--cc-panel-grad-to)',
                }}
              >
                {THEMES.map(theme => (
                  <option key={theme.id} value={theme.id}>
                    {theme.name}
                  </option>
                ))}
                {summonedLand && <option value={SUMMONED_THEME_ID}>✦ {summonedLand}</option>}
              </select>

              {/* Reshape */}
              <button
                type="button"
                className="cc-btn"
                onClick={() => { onReshuffle(); setOverflowOpen(false) }}
                style={overflowItem}
                title="Build this world again, differently"
              >
                Reshape world
              </button>

              {/* Worlds */}
              <button
                type="button"
                className="cc-btn"
                onClick={() => { setWorldsOpen(true); setOverflowOpen(false) }}
                style={{ ...overflowItem, ...(activeWorldId ? activeChip : {}) }}
                aria-label={activeWorldId ? 'Worlds — this world is saved' : 'Worlds — open or save a world'}
                title={activeWorldId ? 'This world is saved' : 'Save this world, or open one you saved'}
              >
                Worlds{activeWorldId ? ' ✓' : ''}
              </button>

              <div style={{ height: 1, background: 'var(--cc-panel-divider)', margin: '2px 0' }} />

              {/* Field Guide */}
              <button
                type="button"
                className="cc-btn"
                onClick={() => { setGuideOpen(true); setOverflowOpen(false) }}
                style={overflowItem}
                title="Open the field guide"
              >
                Field Guide
              </button>

              {/* History */}
              <button
                type="button"
                className="cc-btn"
                onClick={() => { onOpenHistory(); setOverflowOpen(false) }}
                disabled={!!replaySnapshots}
                style={overflowItem}
                title="View ecosystem history"
              >
                History
              </button>

              {/* Log */}
              <button
                type="button"
                className="cc-btn"
                onClick={() => { setHistoryOpen(true); setOverflowOpen(false) }}
                style={overflowItem}
                title="View the event log"
              >
                Log
              </button>

              <div style={{ height: 1, background: 'var(--cc-panel-divider)', margin: '2px 0' }} />

              {/* Sound */}
              <button
                type="button"
                className="cc-btn"
                onClick={() => {
                  const next = !soundEnabled
                  if (next) enableSound()
                  else disableSound()
                  setSoundEnabled(next)
                }}
                style={{
                  ...overflowItem,
                  ...(soundEnabled
                    ? { borderColor: 'var(--cc-mint)', color: 'var(--cc-mint)', background: 'rgba(100,220,200,0.08)' }
                    : {}),
                }}
                aria-pressed={soundEnabled}
                title="Toggle ambient sound"
              >
                {soundEnabled ? 'Sound on' : 'Sound off'}
              </button>

              {/* Settings */}
              <button
                type="button"
                className="cc-btn"
                onClick={() => { setSettingsOpen(!settingsOpen); setOverflowOpen(false) }}
                style={{
                  ...overflowItem,
                  ...(settingsOpen ? activeChip : {}),
                  ...(tuned && !settingsOpen
                    ? { borderColor: 'var(--cc-gold)', color: 'var(--cc-gold)' }
                    : {}),
                }}
                aria-pressed={settingsOpen}
                aria-label="World settings"
                title={tuned ? 'The laws of this land have been changed' : 'Change the laws of this land'}
              >
                <SlidersIcon />
                {tuned ? 'Settings ✦' : 'Settings'}
              </button>

              {/* Share snapshot */}
              <button
                type="button"
                className="cc-btn"
                onClick={() => {
                  const health = ecosystemHealth(population, total)
                  const lines: string[] = [
                    `Micro Land — ${ageLabel} (${formatDuration(elapsed)})`,
                    `${species} kinds · ${total} alive · ${health}`,
                  ]
                  if (steady) lines.push(`Steady for ${steady}`)
                  const text = lines.join('\n')
                  navigator.clipboard.writeText(text).then(() => {
                    setCopied(true)
                    notify('World snapshot copied to clipboard.')
                    setTimeout(() => setCopied(false), 2000)
                  }).catch(() => {
                    notify('Could not copy — try selecting the text manually.')
                  })
                  setOverflowOpen(false)
                }}
                style={overflowItem}
                title="Copy a text summary of this world to the clipboard"
              >
                {copied ? 'Copied!' : 'Share snapshot'}
              </button>

              <div style={{ height: 1, background: 'var(--cc-panel-divider)', margin: '2px 0' }} />

              {/* Clear all — destructive */}
              <button
                type="button"
                className="cc-btn"
                onClick={() => { onClearLife(); setOverflowOpen(false) }}
                style={{
                  ...overflowItem,
                  borderColor: 'var(--cc-pink-border)',
                  color: 'var(--cc-pink)',
                }}
                title="Remove every living thing"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
