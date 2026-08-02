'use client'

import { THEMES } from '@/app/micro-land/domain/config/themes'
import { STEADY_SHOW_SECONDS } from '@/app/micro-land/domain/constants'
import { TUNING_DEFAULTS, type TuningKey } from '@/app/micro-land/domain/tuning'
import { formatDuration } from '@/app/micro-land/format'
import { SUMMONED_THEME_ID, useMicroLand } from '@/app/micro-land/store'

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
}: {
  onReshuffle: () => void
  onClearLife: () => void
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
  const setWorldsOpen = useMicroLand(s => s.setWorldsOpen)
  const activeWorldId = useMicroLand(s => s.shelf.activeId)
  const settingsOpen = useMicroLand(s => s.settingsOpen)
  const setSettingsOpen = useMicroLand(s => s.setSettingsOpen)
  const tuning = useMicroLand(s => s.tuning)

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

  return (
    <header
      className="flex flex-wrap items-center gap-2 px-3 py-2 pl-14"
      style={{
        borderBottom: '1px solid var(--cc-panel-divider)',
        background: 'linear-gradient(180deg, var(--cc-panel-grad-from), transparent)',
      }}
    >
      <h1
        className="hidden sm:block"
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

      <label className="sr-only" htmlFor="micro-land-theme">
        Choose a world
      </label>
      <select
        id="micro-land-theme"
        value={themeId}
        onChange={e => setTheme(e.target.value)}
        style={{
          ...chipBase,
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

      <button
        type="button"
        className="cc-btn"
        onClick={onReshuffle}
        style={chipBase}
        title="Build this world again, differently"
      >
        Reshape
      </button>

      {/*
        Next to the world picker rather than off with the settings, because it is
        part of the same question: which land am I in? The picker chooses a kind
        of world; this chooses one you have already made.
      */}
      <button
        type="button"
        className="cc-btn"
        onClick={() => setWorldsOpen(true)}
        style={{ ...chipBase, ...(activeWorldId ? activeChip : {}) }}
        // The chip highlight says 'saved' visually; the label stopped saying it
        // when this became a noun, so the state has to reach a screen reader
        // some other way than the colour.
        aria-label={
          activeWorldId ? 'Worlds — this world is saved' : 'Worlds — this world is not saved'
        }
        title={
          activeWorldId
            ? 'This world is saved — everything you do here is written back on its own'
            : 'Save this world, or open one you saved'
        }
      >
        Worlds
      </button>

      <div className="flex items-center gap-1" role="group" aria-label="Speed">
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

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          className="cc-btn"
          onClick={() => setSettingsOpen(!settingsOpen)}
          style={{
            ...chipBase,
            padding: '7px 9px',
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
        </button>
        <button
          type="button"
          className="cc-btn"
          onClick={() => setGuideOpen(true)}
          style={chipBase}
          title={steady ? 'How long this land has gone without losing a species' : undefined}
        >
          {species} kinds · {total} alive
          {steady && (
            <>
              {' · '}
              <span style={{ color: 'var(--cc-gold)' }}>{steady} steady</span>
            </>
          )}
        </button>
        <button
          type="button"
          className="cc-btn"
          onClick={onClearLife}
          style={{
            ...chipBase,
            borderColor: 'var(--cc-pink-border)',
            color: 'var(--cc-pink)',
          }}
          title="Remove every living thing"
        >
          Clear all
        </button>
      </div>
    </header>
  )
}
