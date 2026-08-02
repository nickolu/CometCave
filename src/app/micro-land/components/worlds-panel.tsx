'use client'

import { useState } from 'react'

import { THEME_BY_ID } from '@/app/micro-land/domain/config/themes'
import { formatDuration } from '@/app/micro-land/format'
import { useMicroLand } from '@/app/micro-land/store'
import { MAX_SAVED_WORLDS, cleanWorldName } from '@/app/micro-land/worlds/wire'

const heading: React.CSSProperties = {
  fontFamily: 'var(--cc-font-mono)',
  fontSize: 10,
  letterSpacing: 2,
  textTransform: 'uppercase',
  color: 'var(--cc-text-muted)',
}

const buttonBase: React.CSSProperties = {
  fontFamily: 'var(--cc-font-mono)',
  fontSize: 10,
  letterSpacing: 1.2,
  textTransform: 'uppercase',
  padding: '7px 12px',
  minHeight: 34,
  borderRadius: 4,
  border: '1px solid var(--cc-mint-line)',
  background: 'transparent',
  color: 'var(--cc-text-muted)',
}

const primaryButton: React.CSSProperties = {
  ...buttonBase,
  border: '1px solid var(--cc-mint)',
  background: 'var(--cc-mint-soft)',
  color: 'var(--cc-mint)',
}

/** "3 minutes ago" beats a timestamp for a shelf you visit a few times a week. */
function since(at: number): string {
  const seconds = Math.max(0, (Date.now() - at) / 1000)
  if (seconds < 90) return 'just now'
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`
  if (seconds < 86_400) return `${Math.round(seconds / 3600)} hr ago`
  const days = Math.round(seconds / 86_400)
  return days === 1 ? 'yesterday' : `${days} days ago`
}

/**
 * The shelf — worlds the player has kept, and the way back into them.
 *
 * Two things this panel is careful about, both because the person using it is a
 * child mid-play:
 *
 * - Letting go of a world asks first, in place, on the row itself. A modal on
 *   top of a modal is a wall; a row that turns into "Really?" is a question.
 * - Opening a world says out loud that the one on screen is not being kept,
 *   *before* the tap rather than after it. The alternative is a child losing a
 *   land they had been building for twenty minutes and learning that the shelf
 *   is dangerous.
 */
export function WorldsPanel({
  onKeep,
  onOpen,
  onForget,
}: {
  onKeep: (name: string) => void
  onOpen: (id: string) => void
  onForget: (id: string) => void
}) {
  const open = useMicroLand(s => s.worldsOpen)
  const setOpen = useMicroLand(s => s.setWorldsOpen)
  const shelf = useMicroLand(s => s.shelf)
  const themeId = useMicroLand(s => s.themeId)
  const summonedLand = useMicroLand(s => s.summonedLand)
  const total = useMicroLand(s => s.totalCreatures)

  const [name, setName] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)

  if (!open) return null

  const active = shelf.worlds.find(w => w.id === shelf.activeId) ?? null
  const full = shelf.worlds.length >= MAX_SAVED_WORLDS && !active
  const here = summonedLand ?? THEME_BY_ID[themeId]?.name ?? 'This land'

  // Through the same cleaner the server would apply, so a world is called the
  // same thing whether it was kept on this device or on the account.
  const keep = () => {
    onKeep(cleanWorldName(name, active ? active.name : here))
    setName('')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: 'var(--cc-modal-scrim)' }}
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Saved worlds"
        className="w-full max-w-lg overflow-y-auto rounded-t-xl sm:rounded-xl"
        style={{
          maxHeight: '88dvh',
          background: 'linear-gradient(180deg, var(--cc-modal-bg-from), var(--cc-modal-bg-to))',
          border: '1px solid var(--cc-modal-border)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="sticky top-0 flex items-center justify-between px-4 py-3"
          style={{
            borderBottom: '1px solid var(--cc-panel-divider)',
            background: 'var(--cc-modal-bg-from)',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--cc-font-mono)',
              fontSize: 11,
              letterSpacing: 2.5,
              textTransform: 'uppercase',
              color: 'var(--cc-mint)',
            }}
          >
            Your worlds
          </h2>
          <button
            type="button"
            className="cc-btn"
            onClick={() => setOpen(false)}
            aria-label="Close"
            style={{ minWidth: 44, minHeight: 34, color: 'var(--cc-text-muted)' }}
          >
            ✕
          </button>
        </div>

        <section
          className="flex flex-col gap-2 px-4 py-3"
          style={{ borderBottom: '1px solid var(--cc-panel-divider)' }}
        >
          <h3 style={heading}>{active ? 'Kept as' : 'Keep this one'}</h3>
          <p style={{ fontSize: 12, color: 'var(--cc-text-muted)' }}>
            {active
              ? `${active.name} — everything you do here is written back on its own.`
              : `${here}, ${total} alive. Give it a name and it will be waiting exactly like this.`}
          </p>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="micro-land-world-name">
              Name this world
            </label>
            <input
              id="micro-land-world-name"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') keep()
              }}
              maxLength={40}
              placeholder={active ? active.name : here}
              className="min-w-0 flex-1"
              style={{
                fontSize: 13,
                padding: '8px 10px',
                minHeight: 38,
                borderRadius: 4,
                border: '1px solid var(--cc-mint-line)',
                background: 'var(--cc-panel-grad-to)',
                color: 'var(--cc-text-default)',
              }}
            />
            <button
              type="button"
              className="cc-btn shrink-0"
              onClick={keep}
              disabled={shelf.busy || full}
              style={{ ...primaryButton, opacity: shelf.busy || full ? 0.45 : 1 }}
            >
              {active ? 'Save now' : 'Keep it'}
            </button>
          </div>
          {full && (
            <p style={{ fontSize: 11, color: 'var(--cc-gold)' }}>
              The shelf holds {MAX_SAVED_WORLDS}. Let one go to make room.
            </p>
          )}
          {shelf.error && (
            <p style={{ fontSize: 11, color: 'var(--cc-gold)' }}>The cave says: {shelf.error}</p>
          )}
        </section>

        <section className="flex flex-col gap-2 px-4 py-3">
          <h3 style={heading}>
            On the shelf · {shelf.worlds.length}/{MAX_SAVED_WORLDS}
          </h3>

          {shelf.worlds.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--cc-text-muted)' }}>
              Nothing kept yet. A world you keep comes back exactly as you left it — same ground,
              same creatures, same hungers.
            </p>
          )}

          <ul className="flex flex-col gap-2">
            {shelf.worlds.map(world => {
              const isActive = world.id === shelf.activeId
              return (
                <li
                  key={world.id}
                  className="flex items-center gap-3 rounded px-3 py-2"
                  style={{
                    border: `1px solid ${isActive ? 'var(--cc-mint)' : 'var(--cc-mint-line)'}`,
                    background: isActive ? 'var(--cc-mint-soft)' : 'transparent',
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate"
                      style={{ fontSize: 13, color: 'var(--cc-text-default)' }}
                    >
                      {world.name}
                      {isActive && (
                        <span style={{ color: 'var(--cc-mint)', fontSize: 11 }}> · open now</span>
                      )}
                    </p>
                    <p
                      style={{
                        fontFamily: 'var(--cc-font-mono)',
                        fontSize: 10,
                        color: 'var(--cc-text-muted)',
                      }}
                    >
                      {world.landName ?? THEME_BY_ID[world.themeId]?.name ?? world.themeId} ·{' '}
                      {world.creatures} alive · {formatDuration(world.elapsed)} old ·{' '}
                      {since(world.updatedAt)}
                    </p>
                  </div>

                  {confirming === world.id ? (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        className="cc-btn"
                        onClick={() => {
                          onForget(world.id)
                          setConfirming(null)
                        }}
                        style={{
                          ...buttonBase,
                          borderColor: 'var(--cc-pink-border)',
                          background: 'var(--cc-pink-soft)',
                          color: 'var(--cc-pink)',
                        }}
                      >
                        Really
                      </button>
                      <button
                        type="button"
                        className="cc-btn"
                        onClick={() => setConfirming(null)}
                        style={buttonBase}
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <div className="flex shrink-0 items-center gap-1.5">
                      {!isActive && (
                        <button
                          type="button"
                          className="cc-btn"
                          onClick={() => {
                            onOpen(world.id)
                            setOpen(false)
                          }}
                          disabled={shelf.busy}
                          style={{ ...primaryButton, opacity: shelf.busy ? 0.45 : 1 }}
                        >
                          Open
                        </button>
                      )}
                      <button
                        type="button"
                        className="cc-btn"
                        onClick={() => setConfirming(world.id)}
                        aria-label={`Let go of ${world.name}`}
                        style={buttonBase}
                      >
                        Let go
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          {!active && shelf.worlds.length > 0 && (
            <p style={{ fontSize: 11, color: 'var(--cc-text-muted)' }}>
              The land you are in now is not on the shelf. Opening one of these leaves it behind.
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
