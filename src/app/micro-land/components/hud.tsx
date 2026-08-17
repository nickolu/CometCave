'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

import { disableSound, enableSound } from '@/app/micro-land/audio/sound-engine'
import { STEADY_SHOW_SECONDS } from '@/app/micro-land/domain/constants'
import { TUNING_DEFAULTS, type TuningKey } from '@/app/micro-land/domain/tuning'
import { formatDuration } from '@/app/micro-land/format'
import { type PopulationEntry, type SidebarView, useMicroLand } from '@/app/micro-land/store'
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

export function Hud({ onOpenHistory }: { onOpenHistory: () => void }) {
  const paused = useMicroLand(s => s.paused)
  const togglePaused = useMicroLand(s => s.togglePaused)
  const speed = useMicroLand(s => s.speed)
  const setSpeed = useMicroLand(s => s.setSpeed)
  const total = useMicroLand(s => s.totalCreatures)
  const population = useMicroLand(s => s.population)
  const steadySeconds = useMicroLand(s => s.records.steadySeconds)
  const elapsed = useMicroLand(s => s.elapsed)
  const activeWorldId = useMicroLand(s => s.shelf.activeId)
  const sidebar = useMicroLand(s => s.sidebar)
  const setSidebar = useMicroLand(s => s.setSidebar)
  const toggleSidebar = useMicroLand(s => s.toggleSidebar)
  const tuning = useMicroLand(s => s.tuning)
  const challengeActive = useMicroLand(s => s.challengeActive)
  const setChallengeActive = useMicroLand(s => s.setChallengeActive)
  const adaptiveRun = useMicroLand(s => s.adaptiveRun)
  const endAdaptiveRun = useMicroLand(s => s.endAdaptiveRun)

  const replaySnapshots = useMicroLand(s => s.replaySnapshots)
  const soundEnabled = useMicroLand(s => s.soundEnabled)
  const setSoundEnabled = useMicroLand(s => s.setSoundEnabled)
  const nutrientOverlayEnabled = useMicroLand(s => s.nutrientOverlayEnabled)
  const setNutrientOverlayEnabled = useMicroLand(s => s.setNutrientOverlayEnabled)
  const tempOverlayEnabled = useMicroLand(s => s.tempOverlayEnabled)
  const setTempOverlayEnabled = useMicroLand(s => s.setTempOverlayEnabled)

  const setSummonOpen = useMicroLand(s => s.setSummonOpen)
  const tool = useMicroLand(s => s.tool)
  const setTool = useMicroLand(s => s.setTool)

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
    elapsed >= 1800 ? 'Ancient' :
    elapsed >= 600  ? 'Established' :
    'Young'

  const [overflowOpen, setOverflowOpen] = useState(false)
  const overflowRef = useRef<HTMLDivElement>(null)
  const overflowBtnRef = useRef<HTMLButtonElement>(null)

  // The header clips its own overflow so a crowded chip row can never push the
  // page sideways on a phone. That clipping also swallowed this dropdown whole:
  // it hangs *below* the header, so an absolutely positioned menu opened, sat
  // outside the header's box, and was painted nowhere — the button looked dead.
  // CSS can't clip one axis and spill the other (a visible axis paired with a
  // hidden one computes to auto), so the menu is positioned fixed instead and
  // anchored to the button's measured rect. Nothing above it is transformed, so
  // fixed genuinely escapes the clip.
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)

  useEffect(() => {
    if (!overflowOpen) return

    const place = () => {
      const rect = overflowBtnRef.current?.getBoundingClientRect()
      if (rect) setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    place()

    const onDown = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', place)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', place)
    }
  }, [overflowOpen])

  // Every panel item in the menu does the same two things: show the panel and
  // put the menu away. The menu is a launcher, not a place to stand.
  const openSidebar = (view: SidebarView) => {
    setSidebar(view)
    setOverflowOpen(false)
  }

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
      className="flex flex-wrap items-center gap-2 px-3 py-2 pl-14"
      style={{
        borderBottom: '1px solid var(--cc-panel-divider)',
        background: 'linear-gradient(180deg, var(--cc-panel-grad-from), transparent)',
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

      <div className="flex shrink-0 items-center gap-2" role="group" aria-label="Speed">
        <button
          type="button"
          className="cc-btn"
          onClick={togglePaused}
          style={{ ...chipBase, ...(paused ? activeChip : {}) }}
          aria-pressed={paused}
        >
          {paused ? 'Paused' : 'Pause'}
        </button>
        <input
          type="range"
          min={0.5}
          max={7}
          step={0.5}
          value={speed}
          onChange={e => setSpeed(parseFloat(e.target.value))}
          aria-label="Simulation speed"
          style={{ width: 72, accentColor: 'var(--cc-mint)', cursor: 'pointer' }}
        />
        <span
          style={{
            fontFamily: 'var(--cc-font-mono)',
            fontSize: 10,
            letterSpacing: 1,
            color: 'var(--cc-text-muted)',
            minWidth: 22,
          }}
        >
          {speed % 1 === 0 ? `${speed}×` : `${speed}×`}
        </span>
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
          onClick={() => toggleSidebar('guide')}
          style={{ ...chipBase, ...(sidebar === 'guide' ? activeChip : {}) }}
          aria-pressed={sidebar === 'guide'}
          title="Open the field guide"
        >
          {species} kinds · {total} alive
          {steady && (
            <>
              {' · '}
              <span className="hidden sm:inline" style={{ color: 'var(--cc-gold)' }}>{steady} steady</span>
            </>
          )}
          {' · '}
          <span
            className="hidden sm:inline"
            style={{
              color: ageLabel === 'Young'
                ? 'var(--cc-text-muted)'
                : 'var(--cc-gold)',
            }}
          >
            {ageLabel}
          </span>
        </button>

        {/* Ecosystem health — informational */}
        {(() => {
          const status = ecosystemHealth(population, total)
          return (
            <span
              className="hidden sm:inline-flex"
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

        {/* Auth — hidden on mobile, accessible via overflow menu */}
        {!authLoading && (
          <Link
            className="hidden sm:block"
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
            ref={overflowBtnRef}
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

          {overflowOpen && menuPos && (
            <div
              style={{
                position: 'fixed',
                right: menuPos.right,
                top: menuPos.top,
                minWidth: 200,
                // Micro Land is played landscape, so on a short phone the full
                // list is taller than what's left below the header — scroll it
                // rather than run the last items off the bottom of the screen.
                maxHeight: `calc(100vh - ${menuPos.top + 8}px)`,
                overflowY: 'auto',
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
              {/* Making things — the reason anyone opens this menu twice. */}
              <button
                type="button"
                className="cc-btn"
                onClick={() => openSidebar('creatures')}
                style={{ ...overflowItem, ...(sidebar === 'creatures' ? activeChip : {}) }}
                title="Draw a creature, or build one from a species already here"
              >
                Creatures
              </button>

              <button
                type="button"
                className="cc-btn"
                onClick={() => openSidebar('challenges')}
                style={{ ...overflowItem, ...(sidebar === 'challenges' ? activeChip : {}) }}
                title="Run this land against a set of rules"
              >
                Challenges
              </button>

              <div style={{ height: 1, background: 'var(--cc-panel-divider)', margin: '2px 0' }} />

              {/* Worlds — keeping this one, opening a kept one, starting a new one */}
              <button
                type="button"
                className="cc-btn"
                onClick={() => openSidebar('worlds')}
                style={{
                  ...overflowItem,
                  ...(sidebar === 'worlds' || activeWorldId ? activeChip : {}),
                }}
                aria-label={activeWorldId ? 'Worlds — this world is saved' : 'Worlds — open or save a world'}
                title={activeWorldId ? 'This world is saved' : 'Save this world, or open one you saved'}
              >
                Worlds{activeWorldId ? ' ✓' : ''}
              </button>

              <div style={{ height: 1, background: 'var(--cc-panel-divider)', margin: '2px 0' }} />

              {/* Field Guide — also on the stats chip, but the chip reads as a
                  readout and plenty of people never think to press it. */}
              <button
                type="button"
                className="cc-btn"
                onClick={() => openSidebar('guide')}
                style={{ ...overflowItem, ...(sidebar === 'guide' ? activeChip : {}) }}
                title="Open the field guide"
              >
                Field Guide
              </button>

              {/* Looking back */}
              <button
                type="button"
                className="cc-btn"
                onClick={() => { onOpenHistory(); setOverflowOpen(false) }}
                disabled={!!replaySnapshots}
                style={overflowItem}
                title="Wind the world back and watch it again"
              >
                Replay
              </button>

              <button
                type="button"
                className="cc-btn"
                onClick={() => openSidebar('log')}
                style={{ ...overflowItem, ...(sidebar === 'log' ? activeChip : {}) }}
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

              {/* Nutrient overlay */}
              <button
                type="button"
                className="cc-btn"
                onClick={() => setNutrientOverlayEnabled(!nutrientOverlayEnabled)}
                aria-pressed={nutrientOverlayEnabled}
                title="Show soil fertility distribution as a green heat map across the world"
                style={{
                  ...overflowItem,
                  ...(nutrientOverlayEnabled
                    ? { borderColor: '#00cc44', color: '#00cc44', background: 'rgba(0,204,68,0.08)' }
                    : {}),
                }}
              >
                {nutrientOverlayEnabled ? 'Nutrients on' : 'Nutrients'}
              </button>
              {/* Temperature overlay */}
              <button
                type="button"
                className="cc-btn"
                onClick={() => setTempOverlayEnabled(!tempOverlayEnabled)}
                aria-pressed={tempOverlayEnabled}
                title="Show a temperature gradient overlay across the world"
                style={{
                  ...overflowItem,
                  ...(tempOverlayEnabled
                    ? { borderColor: 'var(--cc-mint)', color: 'var(--cc-mint)', background: 'rgba(100,220,200,0.08)' }
                    : {}),
                }}
              >
                {tempOverlayEnabled ? 'Temp overlay on' : 'Temp overlay'}
              </button>

              {/* Settings */}
              <button
                type="button"
                className="cc-btn"
                onClick={() => openSidebar('settings')}
                style={{
                  ...overflowItem,
                  ...(sidebar === 'settings' ? activeChip : {}),
                  ...(tuned && sidebar !== 'settings'
                    ? { borderColor: 'var(--cc-gold)', color: 'var(--cc-gold)' }
                    : {}),
                }}
                aria-pressed={sidebar === 'settings'}
                aria-label="World settings"
                title={tuned ? 'The laws of this land have been changed' : 'Change the laws of this land'}
              >
                <SlidersIcon />
                {tuned ? 'Settings ✦' : 'Settings'}
              </button>

              <div style={{ height: 1, background: 'var(--cc-panel-divider)', margin: '2px 0' }} />

              {/* Clear — its own panel, because "clear" is more than one question */}
              <button
                type="button"
                className="cc-btn"
                onClick={() => openSidebar('clear')}
                style={{
                  ...overflowItem,
                  borderColor: 'var(--cc-pink-border)',
                  color: 'var(--cc-pink)',
                }}
                title="Take away the living things, or the whole land"
              >
                Clear…
              </button>

              <div style={{ height: 1, background: 'var(--cc-panel-divider)', margin: '2px 0' }} />
              {!authLoading && (
                <Link
                  href="/auth"
                  style={{
                    ...overflowItem,
                    ...(isSignedIn
                      ? { color: 'var(--cc-text-default)' }
                      : { color: 'var(--cc-mint)', borderColor: 'var(--cc-mint)' }),
                  }}
                >
                  {authLabel}
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
