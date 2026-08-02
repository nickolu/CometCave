'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { sanitizeBlueprint } from '@/app/micro-land/domain/blueprint'
import {
  BODY_PLANS,
  CANVAS_SIZES,
  DEFAULT_INKS,
  DIET_CHOICES,
  type DietId,
  type Draft,
  FRAME_SPEEDS,
  INK_NAMES,
  MAX_DRAFT_FRAMES,
  type PlanId,
  SIZE_WORDS,
  blankDraft,
  buildRawCreature,
  dietOf,
  draftFromBlueprint,
  floodFill,
  inkBounds,
  planOf,
  resizeDraft,
  sizeForWidth,
  trimDraft,
} from '@/app/micro-land/domain/creature-kit'
import type { CreatureBlueprint } from '@/app/micro-land/domain/types'
import { useMicroLand } from '@/app/micro-land/store'

import { CreaturePortrait } from './creature-chip'
import { PixelCanvas } from './pixel-canvas'
import { SparkleIcon } from './sparkle-icon'
import { SummonLoader } from './summon-loader'

/**
 * The creature builder.
 *
 * Summoning hands you a finished creature. This hands you the pencil — and,
 * because a blank grid is the least inviting thing in the world, it will draw a
 * first attempt from a description so there is always something to change
 * rather than something to start.
 *
 * Only the pixels are drawn here. Everything else a creature needs comes from
 * four choices — how it moves, what it eats, whether it glows, whether fire
 * hurts it — and one number read straight off the drawing: how big it is. The
 * rest of the blueprint is inherited from whatever the drawing started from, so
 * recolouring a summoned creature keeps the parts of it that no canvas can
 * express.
 */

const IDEAS = [
  'a tiny glowing snail',
  'a fat orange fish',
  'a paper bird',
  'a mushroom with a face',
  'a spiky purple beetle',
]

/** How many to drop into the world the moment it is finished. */
const PLACE_COUNT = 4

type PaintTool = 'draw' | 'fill' | 'erase' | 'pick'

const TOOLS: { id: PaintTool; label: string; glyph: string }[] = [
  { id: 'draw', label: 'Draw', glyph: '✎' },
  { id: 'fill', label: 'Fill', glyph: '▨' },
  { id: 'erase', label: 'Rub out', glyph: '⌫' },
  { id: 'pick', label: 'Copy colour', glyph: '⊙' },
]

/** Undo depth. Deep enough to walk back a bad idea, shallow enough to be free. */
const MAX_HISTORY = 40

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

function inkName(hex: string): string {
  return INK_NAMES[hex] ?? hex
}

/** The palette to open with: the drawing's own colours first, then the basics. */
function inksFor(draft: Draft): string[] {
  const used: string[] = []
  for (const cells of draft.frames) {
    for (const hex of cells) {
      if (hex && !used.includes(hex)) used.push(hex)
    }
  }
  return [...used, ...DEFAULT_INKS.filter(hex => !used.includes(hex))].slice(0, 18)
}

export function CreatureBuilder({
  onIntroduce,
}: {
  onIntroduce: (
    raw: unknown,
    count: number
  ) => { blueprint: CreatureBlueprint; placed: number } | null
}) {
  const open = useMicroLand(s => s.builderOpen)
  const setOpen = useMicroLand(s => s.setBuilderOpen)
  const blueprints = useMicroLand(s => s.blueprints)
  const setTool = useMicroLand(s => s.setTool)
  const notify = useMicroLand(s => s.notify)

  const [draft, setDraft] = useState<Draft | null>(null)
  const [seed, setSeed] = useState<CreatureBlueprint | null>(null)
  const [name, setName] = useState('')
  const [frame, setFrame] = useState(0)
  const [tool, setPaintTool] = useState<PaintTool>('draw')
  const [inks, setInks] = useState<string[]>(DEFAULT_INKS)
  const [color, setColor] = useState(DEFAULT_INKS[6])
  const [onion, setOnion] = useState(true)
  const [planId, setPlanId] = useState<PlanId>('walk')
  const [dietId, setDietId] = useState<DietId>('plant')
  const [glows, setGlows] = useState(false)
  const [fireproof, setFireproof] = useState(false)

  const [past, setPast] = useState<Draft[]>([])
  const [future, setFuture] = useState<Draft[]>([])

  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const openerRef = useRef<HTMLElement | null>(null)

  // The panel closes out from under whatever opened it, so focus has to go back
  // rather than to the top of the page.
  useEffect(() => {
    if (open) {
      openerRef.current = document.activeElement as HTMLElement | null
      return
    }
    openerRef.current?.focus()
    openerRef.current = null
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      abortRef.current?.abort()
      setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  useEffect(() => () => abortRef.current?.abort(), [])

  /** Adopt a drawing and everything that came with it. */
  const adopt = useCallback((next: Draft, from: CreatureBlueprint | null) => {
    setDraft(next)
    setSeed(from)
    setPast([])
    setFuture([])
    setFrame(0)
    const palette = inksFor(next)
    setInks(palette)
    setColor(palette[0] ?? DEFAULT_INKS[6])
    if (from) {
      setName(from.name)
      setPlanId(planOf(from))
      setDietId(dietOf(from))
      setGlows(from.glow > 0)
      setFireproof(from.body.immuneTo.includes('lava'))
    } else {
      setName('')
      setPlanId('walk')
      setDietId('plant')
      setGlows(false)
      setFireproof(false)
    }
  }, [])

  /**
   * Snapshot for undo.
   *
   * Reads `draft` out of the closure rather than out of a state updater: every
   * caller is an event handler, so the closure is already current, and React
   * is free to run an updater more than once — which would push the same
   * snapshot twice and make undo take two presses.
   */
  const pushHistory = useCallback(() => {
    if (!draft) return
    setPast(p => [...p, draft].slice(-MAX_HISTORY))
    setFuture([])
  }, [draft])

  const paint = useCallback(
    (index: number, first: boolean) => {
      if (tool === 'pick') {
        const hex = first ? draft?.frames[frame][index] : null
        if (hex) {
          setColor(hex)
          setInks(list => (list.includes(hex) ? list : appendInk(list, hex)))
        }
        return
      }

      if (first) pushHistory()
      const value = tool === 'erase' ? null : color

      setDraft(prev => {
        if (!prev) return prev
        const cells = prev.frames[frame]
        let next: (string | null)[]

        if (tool === 'fill') {
          next = floodFill(cells, prev.w, prev.h, index, value)
        } else {
          if (cells[index] === value) return prev
          next = cells.slice()
          next[index] = value
        }

        if (next === cells) return prev
        const frames = prev.frames.slice()
        frames[frame] = next
        return { ...prev, frames }
      })
    },
    [tool, color, frame, draft, pushHistory]
  )

  const undo = useCallback(() => {
    if (past.length === 0 || !draft) return
    setFuture(f => [draft, ...f].slice(0, MAX_HISTORY))
    setDraft(past[past.length - 1])
    setPast(p => p.slice(0, -1))
  }, [past, draft])

  const redo = useCallback(() => {
    if (future.length === 0 || !draft) return
    setPast(p => [...p, draft].slice(-MAX_HISTORY))
    setDraft(future[0])
    setFuture(f => f.slice(1))
  }, [future, draft])

  /** Ask for a first attempt. Same route, same model, same sanitizer as summoning. */
  async function drawFromPrompt() {
    const description = prompt.trim()
    if (description.length < 2 || busy) return

    setBusy(true)
    setError(null)
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch('/api/v1/micro-land/summon', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'creature', prompt: description }),
        signal: controller.signal,
      })
      if (!response.ok) throw new Error('That did not come through. Try again.')
      const data = (await response.json()) as { blueprint?: unknown }
      const blueprint = sanitizeBlueprint(data.blueprint, { summoned: true })
      adopt(draftFromBlueprint(blueprint), blueprint)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError('Nothing came through. Try describing it a different way.')
    } finally {
      abortRef.current = null
      setBusy(false)
    }
  }

  function bringToLife() {
    if (!draft || empty) return
    const raw = buildRawCreature({ name, draft, planId, dietId, glows, fireproof, seed })
    const result = onIntroduce(raw, PLACE_COUNT)
    if (!result) {
      setError('It would not hold together. Try again.')
      return
    }
    setTool({ kind: 'creature', blueprintId: result.blueprint.id })
    notify(`${result.blueprint.name} steps out of the drawing.`)
    setOpen(false)
  }

  // Both walk every pixel of every frame. `draft` is replaced rather than
  // mutated, so the compiler's own memoization keys off it exactly and neither
  // re-runs on the cells of a drag that didn't change it.
  const empty = draft === null || inkBounds(draft) === null
  const trimmed = draft ? trimDraft(draft) : null
  const size = trimmed && !empty ? sizeForWidth(trimmed.w) : 0

  const describe = useCallback(
    (index: number) => {
      if (!draft) return ''
      const x = (index % draft.w) + 1
      const y = ((index / draft.w) | 0) + 1
      const hex = draft.frames[frame][index]
      return `Row ${y}, column ${x}, ${hex ? inkName(hex) : 'empty'}`
    },
    [draft, frame]
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: 'var(--cc-modal-scrim)' }}
      onClick={() => !busy && setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Creature builder"
        className="w-full max-w-md overflow-y-auto rounded-t-xl md:max-w-3xl md:rounded-xl"
        style={{
          maxHeight: '92dvh',
          background: 'linear-gradient(180deg, var(--cc-modal-bg-from), var(--cc-modal-bg-to))',
          border: '1px solid var(--cc-modal-border)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '1px solid var(--cc-panel-divider)' }}
        >
          <h2 style={heading}>✎ Creature Builder</h2>
          <button
            type="button"
            className="cc-btn"
            onClick={() => {
              abortRef.current?.abort()
              setOpen(false)
            }}
            aria-label="Close"
            style={{ minWidth: 44, minHeight: 34, color: 'var(--cc-text-muted)' }}
          >
            ✕
          </button>
        </div>

        {busy ? (
          // The same wait the summon panel shows. Drawing a first attempt is the
          // same model call taking the same minute, so it gets the same sand —
          // two different loaders for one wait read as two different features.
          <div className="flex flex-col items-center">
            <SummonLoader
              mode="creature"
              prompt={prompt.trim()}
              onCancel={() => abortRef.current?.abort()}
            />
            <p
              style={{
                fontSize: 13,
                color: 'var(--cc-text-muted)',
                textAlign: 'center',
                padding: '0 16px 16px',
              }}
            >
              You can change every pixel of it afterwards.
            </p>
          </div>
        ) : !draft ? (
          <StartStep
            prompt={prompt}
            setPrompt={setPrompt}
            onDraw={() => void drawFromPrompt()}
            onBlank={(w, h) => adopt(blankDraft(w, h), null)}
            onCopy={bp => adopt(draftFromBlueprint(bp), bp)}
            blueprints={blueprints}
            error={error}
          />
        ) : (
          <div className="flex flex-col gap-4 p-4 md:flex-row md:items-start">
            {/* ---- the drawing ---- */}
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <PixelCanvas
                w={draft.w}
                h={draft.h}
                cells={draft.frames[frame]}
                ghost={
                  onion && draft.frames.length > 1
                    ? draft.frames[(frame + 1) % draft.frames.length]
                    : null
                }
                onPaint={paint}
                describe={describe}
                label={`Drawing of ${name || 'a new creature'}, ${draft.w} squares across and ${draft.h} down.`}
              />

              <div
                className="flex flex-wrap items-center gap-1.5"
                role="group"
                aria-label="Drawing tools"
              >
                {TOOLS.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    className="cc-btn"
                    onClick={() => setPaintTool(t.id)}
                    aria-pressed={tool === t.id}
                    style={chipStyle(tool === t.id)}
                  >
                    <span aria-hidden style={{ marginRight: 5 }}>
                      {t.glyph}
                    </span>
                    {t.label}
                  </button>
                ))}
                <span className="flex-1" />
                <button
                  type="button"
                  className="cc-btn"
                  onClick={undo}
                  disabled={past.length === 0}
                  aria-label="Undo"
                  style={{ ...chipStyle(false), opacity: past.length === 0 ? 0.35 : 1 }}
                >
                  ↶
                </button>
                <button
                  type="button"
                  className="cc-btn"
                  onClick={redo}
                  disabled={future.length === 0}
                  aria-label="Redo"
                  style={{ ...chipStyle(false), opacity: future.length === 0 ? 0.35 : 1 }}
                >
                  ↷
                </button>
              </div>

              <div>
                <span style={label}>Colours</span>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {inks.map(hex => {
                    const selected = hex === color && tool !== 'erase'
                    return (
                      <button
                        key={hex}
                        type="button"
                        className="cc-btn"
                        onClick={() => {
                          setColor(hex)
                          if (tool === 'erase' || tool === 'pick') setPaintTool('draw')
                        }}
                        aria-pressed={selected}
                        aria-label={inkName(hex)}
                        title={inkName(hex)}
                        style={{
                          width: 32,
                          height: 32,
                          display: 'grid',
                          placeItems: 'center',
                          borderRadius: 999,
                          border: `2px solid ${selected ? 'var(--cc-mint)' : 'transparent'}`,
                          background: 'transparent',
                        }}
                      >
                        <span
                          aria-hidden
                          style={{
                            display: 'block',
                            width: 21,
                            height: 21,
                            borderRadius: 999,
                            background: hex,
                            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.4)',
                          }}
                        />
                      </button>
                    )
                  })}
                  <label
                    title="Mix your own colour"
                    style={{
                      width: 32,
                      height: 32,
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: 999,
                      border: '1px dashed var(--cc-mint-line)',
                      cursor: 'pointer',
                    }}
                  >
                    <span aria-hidden style={{ fontSize: 13, color: 'var(--cc-text-muted)' }}>
                      +
                    </span>
                    <input
                      type="color"
                      value={color}
                      aria-label="Mix your own colour"
                      onChange={e => {
                        const hex = e.target.value.toLowerCase()
                        setColor(hex)
                        setInks(list => (list.includes(hex) ? list : appendInk(list, hex)))
                        if (tool === 'erase' || tool === 'pick') setPaintTool('draw')
                      }}
                      style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
                    />
                  </label>
                </div>
              </div>

              <div>
                <span style={label}>Frames</span>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {draft.frames.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      className="cc-btn"
                      onClick={() => setFrame(i)}
                      aria-pressed={frame === i}
                      style={chipStyle(frame === i)}
                    >
                      {i + 1}
                    </button>
                  ))}
                  {draft.frames.length < MAX_DRAFT_FRAMES && (
                    <button
                      type="button"
                      className="cc-btn"
                      title="Add a frame — a copy of this one, so you can nudge it"
                      onClick={() => {
                        pushHistory()
                        setDraft(prev =>
                          prev
                            ? { ...prev, frames: [...prev.frames, prev.frames[frame].slice()] }
                            : prev
                        )
                        setFrame(draft.frames.length)
                      }}
                      style={chipStyle(false)}
                    >
                      + Frame
                    </button>
                  )}
                  {draft.frames.length > 1 && (
                    <button
                      type="button"
                      className="cc-btn"
                      onClick={() => {
                        pushHistory()
                        setDraft(prev =>
                          prev
                            ? { ...prev, frames: prev.frames.filter((_, i) => i !== frame) }
                            : prev
                        )
                        setFrame(f => Math.max(0, f - 1))
                      }}
                      style={chipStyle(false)}
                    >
                      − Frame
                    </button>
                  )}
                  <button
                    type="button"
                    className="cc-btn"
                    onClick={() => setOnion(v => !v)}
                    aria-pressed={onion}
                    title="Show the next frame faintly underneath"
                    style={chipStyle(onion)}
                  >
                    Ghost
                  </button>
                </div>
                <p style={{ ...note, marginTop: 6 }}>
                  {draft.frames.length > 1
                    ? 'Make each frame a small change from the last — a step, a blink, a wing beat.'
                    : 'Add a second frame to make it move.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span style={label}>Speed</span>
                {FRAME_SPEEDS.map(speed => (
                  <button
                    key={speed.id}
                    type="button"
                    className="cc-btn"
                    onClick={() => setDraft(prev => (prev ? { ...prev, frameMs: speed.ms } : prev))}
                    aria-pressed={draft.frameMs === speed.ms}
                    style={chipStyle(draft.frameMs === speed.ms)}
                  >
                    {speed.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ---- what it is ---- */}
            <div className="flex w-full flex-col gap-3 md:w-[250px] md:shrink-0">
              <div
                className="flex items-center gap-3 rounded-lg p-3"
                style={{ background: 'rgba(94,234,212,0.06)' }}
              >
                <DraftPreview art={trimmed as Draft} />
                <div className="min-w-0">
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    maxLength={32}
                    placeholder="Name it"
                    aria-label="Creature name"
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: 4,
                      fontFamily: 'var(--cc-font-mono)',
                      fontSize: 12,
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                      background: 'rgba(0,0,0,0.35)',
                      border: '1px solid var(--cc-mint-line)',
                      color: 'var(--cc-mint)',
                    }}
                  />
                  <div style={{ ...note, marginTop: 5 }}>
                    {empty ? 'Nothing drawn yet' : `Size ${size} — ${SIZE_WORDS[size]}`}
                  </div>
                </div>
              </div>

              <div>
                <span style={label}>Canvas</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {CANVAS_SIZES.map(option => {
                    const selected = draft.w === option.w && draft.h === option.h
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className="cc-btn"
                        onClick={() => {
                          if (selected) return
                          pushHistory()
                          setDraft(prev => (prev ? resizeDraft(prev, option.w, option.h) : prev))
                        }}
                        aria-pressed={selected}
                        style={chipStyle(selected)}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
                <p style={{ ...note, marginTop: 6 }}>
                  How much of the canvas you fill decides how big it is in the world.
                </p>
              </div>

              <div>
                <span style={label}>How it moves</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {BODY_PLANS.map(plan => (
                    <button
                      key={plan.id}
                      type="button"
                      className="cc-btn"
                      onClick={() => setPlanId(plan.id)}
                      aria-pressed={planId === plan.id}
                      title={plan.hint}
                      style={chipStyle(planId === plan.id)}
                    >
                      {plan.label}
                    </button>
                  ))}
                </div>
                <p style={{ ...note, marginTop: 6 }}>
                  {BODY_PLANS.find(p => p.id === planId)?.hint}
                </p>
              </div>

              {planId !== 'root' && (
                <div>
                  <span style={label}>What it eats</span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {DIET_CHOICES.map(choice => (
                      <button
                        key={choice.id}
                        type="button"
                        className="cc-btn"
                        onClick={() => setDietId(choice.id)}
                        aria-pressed={dietId === choice.id}
                        title={choice.hint}
                        style={chipStyle(dietId === choice.id)}
                      >
                        {choice.label}
                      </button>
                    ))}
                  </div>
                  <p style={{ ...note, marginTop: 6 }}>
                    {DIET_CHOICES.find(c => c.id === dietId)?.hint}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  className="cc-btn"
                  onClick={() => setGlows(v => !v)}
                  aria-pressed={glows}
                  style={chipStyle(glows)}
                >
                  ✦ Glows in the dark
                </button>
                <button
                  type="button"
                  className="cc-btn"
                  onClick={() => setFireproof(v => !v)}
                  aria-pressed={fireproof}
                  style={chipStyle(fireproof)}
                >
                  ▲ Lava can’t hurt it
                </button>
              </div>

              {error && (
                <p style={{ fontSize: 13, color: 'var(--cc-pink)' }} role="alert">
                  {error}
                </p>
              )}

              <button
                type="button"
                className="cc-btn"
                onClick={bringToLife}
                disabled={empty}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  fontFamily: 'var(--cc-font-mono)',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  padding: '13px 22px',
                  minHeight: 48,
                  borderRadius: 5,
                  background: 'linear-gradient(180deg, var(--cc-mint), var(--cc-mint-hi))',
                  border: '1px solid var(--cc-mint)',
                  color: 'var(--cc-on-mint)',
                  boxShadow: 'var(--cc-mint-glow)',
                  opacity: empty ? 0.4 : 1,
                }}
              >
                <SparkleIcon size={13} />
                Bring it to life
              </button>

              <button
                type="button"
                className="cc-btn"
                onClick={() => {
                  setDraft(null)
                  setSeed(null)
                  setPast([])
                  setFuture([])
                  setError(null)
                }}
                style={{ ...ghostButton, minHeight: 36 }}
              >
                ← Start again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

function StartStep({
  prompt,
  setPrompt,
  onDraw,
  onBlank,
  onCopy,
  blueprints,
  error,
}: {
  prompt: string
  setPrompt: (value: string) => void
  onDraw: () => void
  onBlank: (w: number, h: number) => void
  onCopy: (bp: CreatureBlueprint) => void
  blueprints: CreatureBlueprint[]
  error: string | null
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => inputRef.current?.focus(), [])

  return (
    <div className="flex flex-col gap-3 p-4">
      <p style={{ fontSize: 13, color: 'var(--cc-text-muted)', lineHeight: 1.5 }}>
        Colour it in yourself, one square at a time. Start from nothing, or describe something and
        get a first sketch you can change every pixel of.
      </p>

      <div className="flex gap-1.5">
        <input
          ref={inputRef}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') onDraw()
          }}
          maxLength={300}
          placeholder={IDEAS[0]}
          aria-label="Describe something to sketch"
          style={{
            flex: 1,
            minWidth: 0,
            padding: '12px 14px',
            minHeight: 46,
            borderRadius: 5,
            fontSize: 15,
            background: 'rgba(0,0,0,0.35)',
            border: '1px solid var(--cc-mint-line)',
            color: 'var(--cc-text-default)',
          }}
        />
        <button
          type="button"
          className="cc-btn"
          onClick={onDraw}
          disabled={prompt.trim().length < 2}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: 'var(--cc-font-mono)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            padding: '0 14px',
            minHeight: 46,
            borderRadius: 5,
            background: 'linear-gradient(180deg, var(--cc-mint), var(--cc-mint-hi))',
            border: '1px solid var(--cc-mint)',
            color: 'var(--cc-on-mint)',
            boxShadow: 'var(--cc-mint-glow)',
            opacity: prompt.trim().length < 2 ? 0.4 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          <SparkleIcon size={12} />
          Sketch it
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {IDEAS.map(idea => (
          <button
            key={idea}
            type="button"
            className="cc-btn"
            onClick={() => setPrompt(idea)}
            style={{
              fontSize: 11,
              padding: '6px 10px',
              minHeight: 32,
              borderRadius: 999,
              border: '1px solid var(--cc-mint-line)',
              color: 'var(--cc-text-muted)',
            }}
          >
            {idea}
          </button>
        ))}
      </div>

      {error && (
        <p style={{ fontSize: 13, color: 'var(--cc-pink)' }} role="alert">
          {error}
        </p>
      )}

      <div style={rule} />

      <div>
        <span style={label}>Or start from an empty canvas</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {CANVAS_SIZES.map(option => (
            <button
              key={option.id}
              type="button"
              className="cc-btn"
              onClick={() => onBlank(option.w, option.h)}
              style={chipStyle(false)}
            >
              {option.label}
              <span style={{ opacity: 0.5, marginLeft: 6 }}>
                {option.w}×{option.h}
              </span>
            </button>
          ))}
        </div>
      </div>

      {blueprints.length > 0 && (
        <>
          <div style={rule} />
          <div>
            <span style={label}>Or change one that already exists</span>
            <div
              className="-mx-1 mt-1.5 flex flex-wrap gap-1.5 overflow-y-auto px-1"
              style={{ maxHeight: '22vh' }}
            >
              {blueprints.map(bp => (
                <button
                  key={bp.id}
                  type="button"
                  className="cc-btn shrink-0"
                  onClick={() => onCopy(bp)}
                  title={bp.blurb}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    padding: '6px 8px',
                    minWidth: 62,
                    minHeight: 44,
                    borderRadius: 5,
                    border: `1px solid ${bp.summoned ? 'var(--cc-pink-border)' : 'var(--cc-mint-line)'}`,
                    background: 'rgba(255,255,255,0.02)',
                  }}
                >
                  <span style={{ height: 34, display: 'grid', placeItems: 'center' }}>
                    <CreaturePortrait blueprint={bp} size={34} />
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--cc-font-mono)',
                      fontSize: 8,
                      letterSpacing: 0.8,
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                      opacity: 0.75,
                    }}
                  >
                    {bp.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

/**
 * The drawing, animating, at the size it will actually be seen.
 *
 * Shows the trimmed art rather than the canvas, because the blank margin is not
 * part of the creature and seeing it padded is misleading about the size.
 */
function DraftPreview({ art }: { art: Draft }) {
  const [step, setStep] = useState(0)
  const [still, setStill] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(REDUCED_MOTION).matches
  )

  useEffect(() => {
    const query = window.matchMedia(REDUCED_MOTION)
    const sync = () => setStill(query.matches)
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  const count = art.frames.length

  useEffect(() => {
    if (still || count < 2) return
    const timer = window.setInterval(() => setStep(s => s + 1), Math.max(60, art.frameMs))
    return () => window.clearInterval(timer)
  }, [still, count, art.frameMs])

  const cells = art.frames[step % count]
  const scale = Math.min(52 / art.w, 52 / art.h)

  return (
    <svg
      viewBox={`0 0 ${art.w} ${art.h}`}
      width={art.w * scale}
      height={art.h * scale}
      shapeRendering="crispEdges"
      aria-hidden
      focusable="false"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {cells.map((hex, i) =>
        hex ? (
          <rect key={i} x={i % art.w} y={(i / art.w) | 0} width={1} height={1} fill={hex} />
        ) : null
      )}
    </svg>
  )
}

// ---------------------------------------------------------------------------

function appendInk(list: string[], hex: string): string[] {
  // Grow the palette rather than shuffling it — a swatch that moves out from
  // under a finger mid-drawing is worse than one that never appears.
  if (list.length < 18) return [...list, hex]
  return [...list.slice(0, -1), hex]
}

const heading: React.CSSProperties = {
  fontFamily: 'var(--cc-font-mono)',
  fontSize: 11,
  letterSpacing: 2.5,
  textTransform: 'uppercase',
  color: 'var(--cc-mint)',
}

const label: React.CSSProperties = {
  fontFamily: 'var(--cc-font-mono)',
  fontSize: 9,
  letterSpacing: 1.6,
  textTransform: 'uppercase',
  opacity: 0.5,
}

const note: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--cc-text-muted)',
  lineHeight: 1.45,
}

const rule: React.CSSProperties = {
  height: 1,
  background: 'var(--cc-panel-divider)',
}

const ghostButton: React.CSSProperties = {
  fontFamily: 'var(--cc-font-mono)',
  fontSize: 10,
  letterSpacing: 1.4,
  textTransform: 'uppercase',
  padding: '8px 14px',
  borderRadius: 4,
  border: '1px solid var(--cc-mint-line)',
  color: 'var(--cc-text-muted)',
  background: 'transparent',
}

function chipStyle(selected: boolean): React.CSSProperties {
  return {
    fontFamily: 'var(--cc-font-mono)',
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    padding: '7px 11px',
    minHeight: 34,
    borderRadius: 4,
    border: `1px solid ${selected ? 'var(--cc-mint)' : 'var(--cc-mint-line)'}`,
    background: selected ? 'var(--cc-mint-soft)' : 'transparent',
    color: selected ? 'var(--cc-mint)' : 'var(--cc-text-muted)',
  }
}
