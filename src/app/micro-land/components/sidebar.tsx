'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { WorkshopPane } from '@/app/micro-land/components/blueprint-workshop'
import { ChallengesPane } from '@/app/micro-land/components/challenges-panel'
import { FieldGuidePane } from '@/app/micro-land/components/field-guide'
import { LogPane } from '@/app/micro-land/components/history-panel'
import { SettingsPane } from '@/app/micro-land/components/settings-panel'
import { WorldsPane } from '@/app/micro-land/components/worlds-panel'
import { type SidebarView, useMicroLand } from '@/app/micro-land/store'

/** What the header says, per panel. */
const TITLES: Record<SidebarView, string> = {
  guide: 'Field Guide',
  worlds: 'Worlds',
  creatures: 'Creatures',
  challenges: 'Challenges',
  log: 'Event Log',
  settings: 'Laws of the Land',
  clear: 'Clear',
}

const MIN_WIDTH = 240
const MAX_WIDTH = 600
const DEFAULT_WIDTH = 300
const WIDTH_KEY = 'ml-sidebar-width'

/**
 * Whether there is room beside the world for a column.
 *
 * Below this the panel becomes a sheet over the bottom of the screen instead,
 * which is what a 300px column on a 360px phone was always pretending to be.
 * Starts false and corrects itself on mount: the store is built during the
 * server render too, and a `matchMedia` read there answers differently than the
 * browser will. Nothing is open on the first paint, so nobody sees the guess.
 */
function useRoomBeside(): boolean {
  const [wide, setWide] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)')
    const update = () => setWide(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return wide
}

/**
 * The one column down the right-hand side.
 *
 * Everything that used to be its own dialog, drawer or bottom sheet — the field
 * guide, the shelf, the log, the knobs — is a pane in here now. Four panels
 * meant four sets of chrome, four ways to close, and two of them could be open
 * at once over the top of each other; the world they all describe is the thing
 * that matters, and it deserves one predictable strip of screen taken away from
 * it rather than an unpredictable stack.
 */
export function Sidebar({
  onKeep,
  onOpenWorld,
  onForget,
  onClearLife,
  onClearWorld,
}: {
  onKeep: (name: string) => void
  onOpenWorld: (id: string) => void
  onForget: (id: string) => void
  onClearLife: () => void
  onClearWorld: () => void
}) {
  const view = useMicroLand(s => s.sidebar)
  const setSidebar = useMicroLand(s => s.setSidebar)
  const wide = useRoomBeside()

  const [width, setWidth] = useState(() => {
    try {
      return Number(localStorage.getItem(WIDTH_KEY)) || DEFAULT_WIDTH
    } catch {
      return DEFAULT_WIDTH
    }
  })
  const dragging = useRef(false)

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      setWidth(prev => Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, prev - ev.movementX)))
    }
    const onUp = () => {
      dragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      setWidth(prev => {
        try {
          localStorage.setItem(WIDTH_KEY, String(prev))
        } catch {}
        return prev
      })
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  if (!view) return null

  return (
    <aside
      aria-label={TITLES[view]}
      className={
        wide
          ? 'flex shrink-0 flex-col overflow-hidden'
          : 'fixed inset-x-0 bottom-0 z-40 flex max-h-[75dvh] flex-col overflow-hidden rounded-t-xl'
      }
      style={{
        position: wide ? 'relative' : undefined,
        width: wide ? width : undefined,
        borderLeft: wide ? '1px solid var(--cc-panel-divider)' : undefined,
        borderTop: wide ? undefined : '1px solid var(--cc-modal-border)',
        background: 'linear-gradient(180deg, var(--cc-modal-bg-from), var(--cc-modal-bg-to))',
      }}
    >
      {/* Drag handle — the seam between the world and the panel. Pointer-only by
          nature, so it is hidden from assistive tech and from the phone layout,
          where the panel is the full width of the screen anyway. */}
      {wide && (
        <div
          aria-hidden
          onMouseDown={handleDragStart}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 5,
            cursor: 'ew-resize',
            zIndex: 1,
            background: 'transparent',
          }}
        />
      )}

      <div
        className="flex shrink-0 items-center justify-between gap-2 px-3 py-2.5"
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
          {TITLES[view]}
        </h2>
        <button
          type="button"
          className="cc-btn"
          onClick={() => setSidebar(null)}
          aria-label={`Close ${TITLES[view].toLowerCase()}`}
          style={{ minWidth: 40, minHeight: 32, color: 'var(--cc-text-muted)' }}
        >
          ✕
        </button>
      </div>

      {/* One scroller for every pane, so no panel has to grow its own. */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {view === 'guide' && <FieldGuidePane />}
        {view === 'worlds' && (
          <WorldsPane onKeep={onKeep} onOpen={onOpenWorld} onForget={onForget} />
        )}
        {view === 'creatures' && <CreaturesPane />}
        {view === 'challenges' && <ChallengesPane />}
        {view === 'log' && <LogPane />}
        {view === 'settings' && <SettingsPane />}
        {view === 'clear' && <ClearPane onClearLife={onClearLife} onClearWorld={onClearWorld} />}
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------------------
// Creatures
// ---------------------------------------------------------------------------

/**
 * The two ways to make a creature, behind one door.
 *
 * Tabs are a stopgap and are meant to read as one: drawing a thing and setting
 * its numbers are two halves of the same act, and a player who draws a shape
 * then wants it faster should not have to know which tool owns "faster". They
 * are separate today because the drawing table and the trait sliders were built
 * as separate tools; the tab row is the seam waiting to be closed.
 *
 * Drawing itself opens the full-screen table rather than happening in here. A
 * pixel grid you can actually paint on, its ink wells, its frames and its
 * stats do not fit a column — squeezing them in would make the tool worse to
 * use in exchange for making the menu tidier.
 */
function CreaturesPane() {
  const tab = useMicroLand(s => s.creaturesTab)
  const setTab = useMicroLand(s => s.setCreaturesTab)
  const setBuilderOpen = useMicroLand(s => s.setBuilderOpen)
  const setSummonOpen = useMicroLand(s => s.setSummonOpen)

  const tabStyle = (active: boolean): React.CSSProperties => ({
    fontFamily: 'var(--cc-font-mono)',
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    padding: '5px 12px',
    minHeight: 30,
    borderRadius: 4,
    border: `1px solid ${active ? 'var(--cc-mint)' : 'var(--cc-panel-divider)'}`,
    background: active ? 'var(--cc-mint-soft)' : 'transparent',
    color: active ? 'var(--cc-mint)' : 'var(--cc-text-muted)',
  })

  return (
    <>
      <div
        className="flex items-center gap-1 px-3 py-2"
        style={{ borderBottom: '1px solid var(--cc-panel-divider)' }}
        role="tablist"
        aria-label="Ways to make a creature"
      >
        <button
          type="button"
          className="cc-btn"
          role="tab"
          aria-selected={tab === 'draw'}
          onClick={() => setTab('draw')}
          style={tabStyle(tab === 'draw')}
        >
          ✎ Draw
        </button>
        <button
          type="button"
          className="cc-btn"
          role="tab"
          aria-selected={tab === 'blueprints'}
          onClick={() => setTab('blueprints')}
          style={tabStyle(tab === 'blueprints')}
        >
          Blueprints
        </button>
      </div>

      {tab === 'draw' ? (
        <div className="flex flex-col gap-3 px-4 py-4">
          <p style={{ fontSize: 12, color: 'var(--cc-text-muted)', lineHeight: 1.55 }}>
            Colour a creature in square by square — its body, how it moves, what it eats — and set
            it loose in the land. It will breed, and its children will look like it.
          </p>
          <button
            type="button"
            className="cc-btn"
            onClick={() => setBuilderOpen(true)}
            style={{
              fontFamily: 'var(--cc-font-mono)',
              fontSize: 10,
              letterSpacing: 1.6,
              textTransform: 'uppercase',
              fontWeight: 700,
              padding: '8px 14px',
              minHeight: 36,
              borderRadius: 4,
              background: 'linear-gradient(180deg, var(--cc-mint), var(--cc-mint-hi))',
              border: '1px solid var(--cc-mint)',
              color: 'var(--cc-on-mint)',
              boxShadow: 'var(--cc-mint-glow)',
            }}
          >
            Open the drawing table
          </button>
          <p
            style={{ fontSize: 11, color: 'var(--cc-text-muted)', opacity: 0.8, lineHeight: 1.55 }}
          >
            The table takes the whole screen — a grid worth painting on does not fit down here.
          </p>
          <div
            className="flex flex-col gap-2 pt-1"
            style={{ borderTop: '1px solid var(--cc-panel-divider)' }}
          >
            <p
              style={{
                fontSize: 11,
                color: 'var(--cc-text-muted)',
                opacity: 0.8,
                lineHeight: 1.55,
                paddingTop: 10,
              }}
            >
              In a hurry? Describe one instead and it will be drawn for you.
            </p>
            <button
              type="button"
              className="cc-btn self-start"
              onClick={() => setSummonOpen(true)}
              style={{
                fontFamily: 'var(--cc-font-mono)',
                fontSize: 10,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                padding: '6px 12px',
                minHeight: 32,
                borderRadius: 4,
                border: '1px solid var(--cc-mint-line)',
                color: 'var(--cc-text-muted)',
              }}
            >
              Generate
            </button>
          </div>
        </div>
      ) : (
        <WorkshopPane />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Clear
// ---------------------------------------------------------------------------

/**
 * Taking things away, with the size of each act said out loud.
 *
 * Every one of these is permanent and none of them is undoable, so each asks
 * once, in place, the way the shelf asks before it lets go of a world. The two
 * are deliberately separated by how much they take: emptying the land of life
 * leaves ground you can immediately put life back into, while emptying the land
 * leaves nothing at all.
 */
function ClearPane({
  onClearLife,
  onClearWorld,
}: {
  onClearLife: () => void
  onClearWorld: () => void
}) {
  const [asking, setAsking] = useState<'life' | 'world' | null>(null)
  const setSidebar = useMicroLand(s => s.setSidebar)

  const run = (act: () => void) => {
    act()
    setAsking(null)
    setSidebar(null)
  }

  return (
    <div className="flex flex-col">
      <p
        className="px-4 py-3"
        style={{ fontSize: 12, color: 'var(--cc-text-muted)', lineHeight: 1.55 }}
      >
        Nothing here can be undone. Whatever you take away is gone — but the land will always let
        you start again.
      </p>

      <ClearOption
        title="The living things"
        blurb="Every plant and every animal. The ground, the water and the weather stay exactly as they are."
        confirm="Clear every living thing?"
        asking={asking === 'life'}
        onAsk={() => setAsking('life')}
        onCancel={() => setAsking(null)}
        onConfirm={() => run(onClearLife)}
      />

      <ClearOption
        title="Everything"
        blurb="The creatures and the land itself. You are left with an empty sky to build in."
        confirm="Clear the whole world?"
        asking={asking === 'world'}
        onAsk={() => setAsking('world')}
        onCancel={() => setAsking(null)}
        onConfirm={() => run(onClearWorld)}
      />
    </div>
  )
}

function ClearOption({
  title,
  blurb,
  confirm,
  asking,
  onAsk,
  onCancel,
  onConfirm,
}: {
  title: string
  blurb: string
  confirm: string
  asking: boolean
  onAsk: () => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const button: React.CSSProperties = {
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

  return (
    <section
      className="flex flex-col gap-2 px-4 py-3"
      style={{ borderTop: '1px solid var(--cc-panel-divider)' }}
    >
      <h3
        style={{
          fontFamily: 'var(--cc-font-mono)',
          fontSize: 10,
          letterSpacing: 2,
          textTransform: 'uppercase',
          color: 'var(--cc-text-muted)',
        }}
      >
        {title}
      </h3>
      <p style={{ fontSize: 12, color: 'var(--cc-text-muted)', lineHeight: 1.55 }}>{blurb}</p>

      {asking ? (
        <>
          <p style={{ fontSize: 12, color: 'var(--cc-gold)' }}>{confirm}</p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="cc-btn"
              onClick={onConfirm}
              style={{
                ...button,
                borderColor: 'var(--cc-pink-border)',
                background: 'var(--cc-pink-soft)',
                color: 'var(--cc-pink)',
              }}
            >
              Clear
            </button>
            <button type="button" className="cc-btn" onClick={onCancel} style={button}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          className="cc-btn self-start"
          onClick={onAsk}
          style={{ ...button, borderColor: 'var(--cc-pink-border)', color: 'var(--cc-pink)' }}
        >
          Clear {title.toLowerCase()}
        </button>
      )}
    </section>
  )
}
