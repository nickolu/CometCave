'use client'

import { useEffect, useRef, useState } from 'react'

import type { CreatureBlueprint } from '@/app/micro-land/domain/types'
import { useMicroLand } from '@/app/micro-land/store'

import { CreaturePortrait } from './creature-chip'
import { SummonLoader } from './summon-loader'

const CREATURE_IDEAS = [
  'a tiny glowing snail that eats moss',
  'a cat made of lava',
  'a paper bird that folds itself',
  'a fat blue fish with whiskers',
  'a spider that walks on the ceiling',
  'a mushroom that grows in the dark',
]

const SCENE_IDEAS = [
  'a swarm of little things chased by something big and slow',
  'a rockpool full of crabs and seaweed',
  'a cave where everything glows',
  'a jungle with tiny dragons in it',
]

const TERRAIN_IDEAS = [
  'a floating island with a waterfall',
  'a deep cave with a lava lake at the bottom',
  'a snowy mountain with a warm cave inside',
  'a swamp full of little pools',
]

type Introduce = (
  raw: unknown,
  count: number
) => { blueprint: CreatureBlueprint; placed: number } | null

type ApplyTerrain = (
  raw: unknown,
  keepCreatures: boolean
) => { name: string; fertile: boolean } | null

export function SummonPanel({
  onIntroduce,
  onApplyTerrain,
}: {
  onIntroduce: Introduce
  onApplyTerrain: ApplyTerrain
}) {
  const open = useMicroLand(s => s.summonOpen)
  const setOpen = useMicroLand(s => s.setSummonOpen)
  const busy = useMicroLand(s => s.summonBusy)
  const setBusy = useMicroLand(s => s.setSummonBusy)
  const mode = useMicroLand(s => s.summonMode)
  const setMode = useMicroLand(s => s.setSummonMode)
  const error = useMicroLand(s => s.summonError)
  const setError = useMicroLand(s => s.setSummonError)
  const setTool = useMicroLand(s => s.setTool)
  const notify = useMicroLand(s => s.notify)

  const [text, setText] = useState('')
  const [made, setMade] = useState<CreatureBlueprint[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  /** Live while a summon is in flight, so the player can call it off. */
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (open && !busy) inputRef.current?.focus()
  }, [open, busy])

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

  // Nothing is left half-applied by an abort: the world is only touched after
  // the response has fully arrived.
  useEffect(() => () => abortRef.current?.abort(), [])

  if (!open) return null

  const ideas = mode === 'scene' ? SCENE_IDEAS : mode === 'terrain' ? TERRAIN_IDEAS : CREATURE_IDEAS

  async function summon() {
    const prompt = text.trim()
    if (prompt.length < 2 || busy) return

    setBusy(true)
    setError(null)
    setMade([])

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch('/api/v1/micro-land/summon', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode, prompt }),
        signal: controller.signal,
      })
      if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(detail?.error ?? 'The summoning fizzled.')
      }

      const data = await response.json()
      const created: CreatureBlueprint[] = []

      if (data.mode === 'terrain') {
        // `null` terrain still builds — sanitizeTerrain falls back to an island.
        const land = onApplyTerrain(data.terrain, false)
        if (land) {
          notify(
            land.fertile
              ? `${land.name} rises out of nothing.`
              : `${land.name} rises — but nothing can take root here. Try adding dirt or sand.`
          )
          setText('')
          // Get out of the way: the whole point was to look at the land.
          setOpen(false)
        } else {
          setError('The land would not hold together. Try describing it again.')
        }
        return
      }

      if (data.mode === 'scene' && Array.isArray(data.creatures)) {
        // Land first: creatures are placed into it, so it has to exist already.
        if (data.terrain) {
          const land = onApplyTerrain(data.terrain, false)
          if (land && !land.fertile) {
            notify(`${land.name} has no soil — plants will struggle here.`)
          }
        }
        for (const entry of data.creatures) {
          const count = Math.max(1, Math.min(40, Number(entry?.count) || 4))
          const result = onIntroduce(entry, count)
          if (result) created.push(result.blueprint)
        }
        if (typeof data.note === 'string' && data.note) notify(data.note)
      } else if (data.blueprint) {
        const result = onIntroduce(data.blueprint, 5)
        if (result) {
          created.push(result.blueprint)
          notify(`${result.blueprint.name} joins the world.`)
        }
      }

      if (created.length === 0) {
        setError('Nothing came through. Try describing it a different way.')
      } else {
        setMade(created)
        // Select the new creature so the next tap places another one.
        setTool({ kind: 'creature', blueprintId: created[0].id })
        setText('')
      }
    } catch (err) {
      // Calling it off isn't a failure — the player already knows what happened.
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setError(err instanceof Error ? err.message : 'The summoning fizzled.')
      }
    } finally {
      abortRef.current = null
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: 'var(--cc-modal-scrim)' }}
      onClick={() => !busy && setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Summon a creature"
        className="w-full max-w-lg overflow-y-auto rounded-t-xl sm:rounded-xl"
        style={{
          maxHeight: '88dvh',
          background: 'linear-gradient(180deg, var(--cc-modal-bg-from), var(--cc-modal-bg-to))',
          border: '1px solid var(--cc-modal-border)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '1px solid var(--cc-panel-divider)' }}
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
            Summon
          </h2>
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
          <SummonLoader
            mode={mode}
            prompt={text.trim()}
            onCancel={() => abortRef.current?.abort()}
          />
        ) : (
          <div className="flex flex-col gap-3 p-4">
            <div className="flex gap-1.5" role="group" aria-label="What to summon">
              {(['creature', 'terrain', 'scene'] as const).map(option => (
                <button
                  key={option}
                  type="button"
                  className="cc-btn flex-1"
                  onClick={() => setMode(option)}
                  aria-pressed={mode === option}
                  style={{
                    fontFamily: 'var(--cc-font-mono)',
                    fontSize: 10,
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                    padding: '9px 10px',
                    minHeight: 40,
                    borderRadius: 4,
                    border: `1px solid ${mode === option ? 'var(--cc-mint)' : 'var(--cc-mint-line)'}`,
                    background: mode === option ? 'var(--cc-mint-soft)' : 'transparent',
                    color: mode === option ? 'var(--cc-mint)' : 'var(--cc-text-muted)',
                  }}
                >
                  {option === 'creature'
                    ? 'One creature'
                    : option === 'terrain'
                      ? 'Just the land'
                      : 'A whole world'}
                </button>
              ))}
            </div>

            <p style={{ fontSize: 13, color: 'var(--cc-text-muted)', lineHeight: 1.5 }}>
              {mode === 'creature'
                ? 'Describe something. It will be drawn, given a body, and dropped into the world.'
                : mode === 'terrain'
                  ? 'Describe a place. The ground, caves and water get rebuilt to match. Creatures already here are cleared out.'
                  : 'Describe a place with things living in it. You get the land AND the creatures, built to suit each other.'}
            </p>

            <input
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') void summon()
              }}
              maxLength={300}
              placeholder={ideas[0]}
              aria-label="Describe what to summon"
              style={{
                width: '100%',
                padding: '12px 14px',
                minHeight: 46,
                borderRadius: 5,
                fontSize: 15,
                background: 'rgba(0,0,0,0.35)',
                border: '1px solid var(--cc-mint-line)',
                color: 'var(--cc-text-default)',
              }}
            />

            <div className="flex flex-wrap gap-1.5">
              {ideas.map(idea => (
                <button
                  key={idea}
                  type="button"
                  className="cc-btn"
                  onClick={() => setText(idea)}
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

            {made.length > 0 && (
              <div
                className="flex flex-col gap-2 rounded-lg p-3"
                style={{ background: 'rgba(94,234,212,0.06)' }}
              >
                {made.map(bp => (
                  <div key={bp.id} className="flex items-center gap-3">
                    <CreaturePortrait blueprint={bp} size={38} />
                    <div className="min-w-0">
                      <div
                        style={{
                          fontFamily: 'var(--cc-font-mono)',
                          fontSize: 11,
                          letterSpacing: 1.4,
                          textTransform: 'uppercase',
                          color: 'var(--cc-mint)',
                        }}
                      >
                        {bp.name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--cc-text-muted)' }}>{bp.blurb}</div>
                    </div>
                  </div>
                ))}
                <p style={{ fontSize: 11, color: 'var(--cc-text-muted)', opacity: 0.8 }}>
                  Tap the world to place more.
                </p>
              </div>
            )}

            <button
              type="button"
              className="cc-btn"
              onClick={() => void summon()}
              disabled={text.trim().length < 2}
              style={{
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
                opacity: text.trim().length < 2 ? 0.4 : 1,
              }}
            >
              {mode === 'creature'
                ? 'Summon it'
                : mode === 'terrain'
                  ? 'Build the land'
                  : 'Summon it all'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
