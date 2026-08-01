'use client'

import { THEMES } from '@/app/micro-land/domain/config/themes'
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
  border: '1px solid var(--cc-mint-line)',
  background: 'transparent',
  color: 'var(--cc-text-muted)',
}

const activeChip: React.CSSProperties = {
  background: 'var(--cc-mint-soft)',
  borderColor: 'var(--cc-mint)',
  color: 'var(--cc-mint)',
}

export function Hud({
  onReshuffle,
  onClearLife,
}: {
  onReshuffle: () => void
  onClearLife: () => void
}) {
  const themeId = useMicroLand((s) => s.themeId)
  const setTheme = useMicroLand((s) => s.setTheme)
  const paused = useMicroLand((s) => s.paused)
  const togglePaused = useMicroLand((s) => s.togglePaused)
  const speed = useMicroLand((s) => s.speed)
  const setSpeed = useMicroLand((s) => s.setSpeed)
  const total = useMicroLand((s) => s.totalCreatures)
  const population = useMicroLand((s) => s.population)
  const setGuideOpen = useMicroLand((s) => s.setGuideOpen)
  const summonedLand = useMicroLand((s) => s.summonedLand)

  const species = population.length

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
        onChange={(e) => setTheme(e.target.value)}
        style={{
          ...chipBase,
          color: 'var(--cc-text-default)',
          background: 'var(--cc-panel-grad-to)',
        }}
      >
        {THEMES.map((theme) => (
          <option key={theme.id} value={theme.id}>
            {theme.name}
          </option>
        ))}
        {summonedLand && (
          <option value={SUMMONED_THEME_ID}>✦ {summonedLand}</option>
        )}
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
        {SPEEDS.map((option) => (
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
          onClick={() => setGuideOpen(true)}
          style={chipBase}
        >
          {species} kinds · {total} alive
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
          Empty
        </button>
      </div>
    </header>
  )
}
