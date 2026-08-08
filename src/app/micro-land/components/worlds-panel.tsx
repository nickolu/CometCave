'use client'

import { useState } from 'react'

import { THEMES, THEME_BY_ID } from '@/app/micro-land/domain/config/themes'
import { formatDuration } from '@/app/micro-land/format'
import { SUMMONED_THEME_ID, useMicroLand } from '@/app/micro-land/store'
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
 * - Letting go of a world asks first, in place, on the row itself. A dialog on
 *   top of the panel is a wall; a row that turns into "Really?" is a question.
 * - Opening a world — or starting over from a template — says out loud that the
 *   one on screen is not being kept, *before* the tap rather than after it. The
 *   alternative is a child losing a land they had been building for twenty
 *   minutes and learning that the shelf is dangerous.
 */
export function WorldsPane({
  onKeep,
  onOpen,
  onForget,
}: {
  onKeep: (name: string) => void
  onOpen: (id: string) => void
  onForget: (id: string) => void
}) {
  const shelf = useMicroLand(s => s.shelf)
  const themeId = useMicroLand(s => s.themeId)
  const setTheme = useMicroLand(s => s.setTheme)
  const summonedLand = useMicroLand(s => s.summonedLand)
  const total = useMicroLand(s => s.totalCreatures)

  const [name, setName] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)
  const [startingOver, setStartingOver] = useState<string | null>(null)

  const active = shelf.worlds.find(w => w.id === shelf.activeId) ?? null
  const full = shelf.worlds.length >= MAX_SAVED_WORLDS && !active
  // Only *while you are standing in it*. `summonedLand` outlives the land it
  // named — it stays on the template list after you have moved on — so reading
  // it unconditionally used to caption an ordinary Cross-Section world with the
  // name of a summoned land the player left an hour ago.
  const here =
    themeId === SUMMONED_THEME_ID
      ? (summonedLand ?? 'This land')
      : (THEME_BY_ID[themeId]?.name ?? 'This land')

  // The land the player asked the model for is a template too — it is the one
  // land they cannot get back any other way once they have left it.
  const templates = summonedLand
    ? [...THEMES, { id: SUMMONED_THEME_ID, name: summonedLand, blurb: 'The land you asked for.' }]
    : THEMES

  // Through the same cleaner the server would apply, so a world is called the
  // same thing whether it was kept on this device or on the account.
  const keep = () => {
    onKeep(cleanWorldName(name, active ? active.name : here))
    setName('')
  }

  return (
    <>
      <section
        className="flex flex-col gap-2 px-4 py-3"
        style={{ borderBottom: '1px solid var(--cc-panel-divider)' }}
      >
        <h3 style={heading}>{active ? 'Saved as' : 'Save this world'}</h3>
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
            Save
          </button>
        </div>
        {full && (
          <p style={{ fontSize: 11, color: 'var(--cc-gold)' }}>
            You can save {MAX_SAVED_WORLDS} worlds. Delete one to make room.
          </p>
        )}
        {shelf.error && (
          <p style={{ fontSize: 11, color: 'var(--cc-gold)' }}>The cave says: {shelf.error}</p>
        )}
      </section>

      <section className="flex flex-col gap-2 px-4 py-3">
        <h3 style={heading}>
          Saved worlds · {shelf.worlds.length}/{MAX_SAVED_WORLDS}
        </h3>

        {shelf.worlds.length === 0 && (
          <p style={{ fontSize: 12, color: 'var(--cc-text-muted)' }}>
            No saved worlds yet. A world you save comes back exactly as you left it — same ground,
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
                      Delete
                    </button>
                    <button
                      type="button"
                      className="cc-btn"
                      onClick={() => setConfirming(null)}
                      style={buttonBase}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex shrink-0 items-center gap-1.5">
                    {!isActive && (
                      <button
                        type="button"
                        className="cc-btn"
                        // The panel stays open: it is a column beside the
                        // world rather than a sheet over it, and the row it
                        // just opened turns into "open now" where you can see
                        // it happen.
                        onClick={() => onOpen(world.id)}
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
                      aria-label={`Delete ${world.name}`}
                      style={buttonBase}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>

        {!active && shelf.worlds.length > 0 && (
          <p style={{ fontSize: 11, color: 'var(--cc-text-muted)' }}>
            The land you are in now is not saved. Opening one of these leaves it behind.
          </p>
        )}
      </section>

      {/*
        The world picker used to be a <select> tucked inside the overflow menu,
        which made "change the land I am in" a settings-shaped act performed
        from a dropdown. It belongs here, beside the worlds you kept, and named
        for what it actually does: everything on screen is replaced by a fresh
        build of whichever template you pick.
      */}
      <section
        className="flex flex-col gap-2 px-4 py-3"
        style={{ borderTop: '1px solid var(--cc-panel-divider)' }}
      >
        <h3 style={heading}>Start from a template</h3>
        <p style={{ fontSize: 12, color: 'var(--cc-text-muted)' }}>
          A new land, built from scratch. Whatever is on screen now is left behind.
        </p>

        <ul className="flex flex-col gap-1.5">
          {templates.map(template => {
            const isHere = template.id === themeId
            const asking = startingOver === template.id
            return (
              <li key={template.id}>
                <div
                  className="flex items-center gap-2 rounded px-3 py-2"
                  style={{
                    border: `1px solid ${isHere ? 'var(--cc-mint)' : 'var(--cc-mint-line)'}`,
                    background: isHere ? 'var(--cc-mint-soft)' : 'transparent',
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p style={{ fontSize: 13, color: 'var(--cc-text-default)' }}>
                      {template.name}
                      {isHere && (
                        <span style={{ color: 'var(--cc-mint)', fontSize: 11 }}>
                          {' '}
                          · you are here
                        </span>
                      )}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--cc-text-muted)' }}>{template.blurb}</p>
                  </div>
                  {asking ? (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        className="cc-btn"
                        onClick={() => {
                          setTheme(template.id)
                          setStartingOver(null)
                        }}
                        style={{
                          ...buttonBase,
                          borderColor: 'var(--cc-pink-border)',
                          background: 'var(--cc-pink-soft)',
                          color: 'var(--cc-pink)',
                        }}
                      >
                        Start
                      </button>
                      <button
                        type="button"
                        className="cc-btn"
                        onClick={() => setStartingOver(null)}
                        style={buttonBase}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="cc-btn shrink-0"
                      // A world already on the shelf is written back before it
                      // is replaced, so leaving it costs nothing and the
                      // question would only be noise. An unsaved one is gone.
                      onClick={() =>
                        active ? setTheme(template.id) : setStartingOver(template.id)
                      }
                      aria-label={`Start from ${template.name}`}
                      style={buttonBase}
                    >
                      Start
                    </button>
                  )}
                </div>
                {asking && (
                  <p style={{ fontSize: 11, color: 'var(--cc-gold)', padding: '4px 3px 0' }}>
                    {here} is not saved. Starting over leaves it behind for good.
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}
