'use client'

import { useState } from 'react'
import { useMicroLand } from '@/app/micro-land/store'
import type { CreatureBlueprint, Traits } from '@/app/micro-land/domain/types'

const TRAIT_DEFS: Array<{ key: keyof Traits; label: string; min: number; max: number; step: number; neutral: number }> = [
  { key: 'speed',       label: 'Speed',        min: 0.6, max: 1.6, step: 0.01, neutral: 1 },
  { key: 'sight',       label: 'Sight',        min: 0.6, max: 1.6, step: 0.01, neutral: 1 },
  { key: 'lifespan',    label: 'Lifespan',     min: 0.6, max: 1.6, step: 0.01, neutral: 1 },
  { key: 'size',        label: 'Size',         min: 0.8, max: 1.2, step: 0.01, neutral: 1 },
  { key: 'roam',        label: 'Roam',         min: 0.6, max: 1.6, step: 0.01, neutral: 1 },
  { key: 'territorial', label: 'Territorial',  min: 0.1, max: 1.4, step: 0.01, neutral: 0.5 },
  { key: 'camouflage',  label: 'Camouflage',   min: 0,   max: 0.8, step: 0.01, neutral: 0.2 },
  { key: 'toxicity',    label: 'Toxicity',     min: 0,   max: 1,   step: 0.01, neutral: 0 },
  { key: 'cooperation', label: 'Cooperation',  min: 0,   max: 1,   step: 0.01, neutral: 0.3 },
  { key: 'immunity',    label: 'Immunity',     min: 0,   max: 1,   step: 0.01, neutral: 0.2 },
]

const LOCO_KINDS = ['walk', 'fly', 'swim', 'crawl', 'drift', 'root'] as const
const DIET_OPTIONS: Array<{ label: string; eats: string[] }> = [
  { label: 'Herbivore', eats: ['plant'] },
  { label: 'Carnivore', eats: ['meat'] },
  { label: 'Omnivore',  eats: ['plant', 'meat'] },
  { label: 'Fungivore', eats: ['plant', 'fungus'] },
]

/** Convert trait hue (0–360) and shade (0.82–1.18) to a preview color. */
function traitColor(hue: number, shade: number): string {
  const lightness = Math.round(30 + shade * 30) // 55–65 range
  return `hsl(${Math.round(hue)}, 60%, ${lightness}%)`
}

function defaultTraits(): Traits {
  return {
    speed: 1, sight: 1, lifespan: 1, hue: 0, shade: 1,
    roam: 1, territorial: 0.5, size: 1, camouflage: 0.2,
    toxicity: 0, cooperation: 0.3, immunity: 0.2,
  }
}

/** The workshop content, usable both inline (inside the Field Guide) and inside the modal wrapper. */
export function WorkshopPane({ onClose }: { onClose: () => void }) {
  const blueprints = useMicroLand(s => s.blueprints)
  const requestWorkshopSpawn = useMicroLand(s => s.requestWorkshopSpawn)
  const setBuilderOpen = useMicroLand(s => s.setBuilderOpen)

  const [step, setStep] = useState<'pick' | 'configure'>('pick')
  const [base, setBase] = useState<CreatureBlueprint | null>(null)
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState(false)
  const [locoKind, setLocoKind] = useState<typeof LOCO_KINDS[number]>('walk')
  const [dietIdx, setDietIdx] = useState(0)
  const [traits, setTraits] = useState<Traits>(defaultTraits)
  const [hue, setHue] = useState(0)
  const [shade, setShade] = useState(1)
  const [sharing, setSharing] = useState(false)
  const [shareMsg, setShareMsg] = useState<string | null>(null)
  const notify = useMicroLand(s => s.notify)

  const animals = blueprints.filter(bp => bp.move.kind !== 'root')
  const displayList = animals.length > 0 ? animals : blueprints

  function pickBase(bp: CreatureBlueprint) {
    setBase(bp)
    setName(bp.name + ' (variant)')
    setLocoKind(bp.move.kind === 'root' ? 'walk' : bp.move.kind)
    // Pick nearest diet option
    const hasPlant = bp.diet.eats.includes('plant')
    const hasMeat = bp.diet.eats.includes('meat')
    if (hasPlant && hasMeat) setDietIdx(2)
    else if (hasMeat) setDietIdx(1)
    else setDietIdx(0)
    setTraits(defaultTraits())
    setHue(0)
    setShade(1)
    setNameError(false)
    setStep('configure')
  }

  function setTrait(key: keyof Traits, value: number) {
    setTraits(t => ({ ...t, [key]: value }))
  }

  function handleSpawn() {
    if (!base) return
    if (!name.trim()) { setNameError(true); return }
    setNameError(false)

    const finalBlueprint: CreatureBlueprint = {
      ...base,
      name: name.trim(),
      move: { ...base.move, kind: locoKind },
      diet: { ...base.diet, eats: DIET_OPTIONS[dietIdx].eats },
    }
    const finalTraits: Traits = { ...traits, hue, shade }
    requestWorkshopSpawn(finalBlueprint, finalTraits)
    onClose()
    setStep('pick')
  }

  async function handleShare() {
    if (!base) return
    if (!name.trim()) { setNameError(true); return }
    setNameError(false)
    setSharing(true)
    setShareMsg(null)
    const finalBlueprint: CreatureBlueprint = {
      ...base,
      name: name.trim(),
      move: { ...base.move, kind: locoKind },
      diet: { ...base.diet, eats: DIET_OPTIONS[dietIdx].eats },
    }
    try {
      // Get auth token if available
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      try {
        const { getAuth } = await import('firebase/auth')
        const { getApp } = await import('firebase/app')
        const user = getAuth(getApp()).currentUser
        if (user) {
          const token = await user.getIdToken()
          headers['Authorization'] = `Bearer ${token}`
        }
      } catch { /* no auth token, still try */ }

      const res = await fetch('/api/v1/micro-land/blueprints', {
        method: 'POST',
        headers,
        body: JSON.stringify({ blueprint: finalBlueprint }),
      })
      if (!res.ok) throw new Error('Save failed')
      const { id } = await res.json() as { id: string }
      const url = `${window.location.origin}/micro-land?blueprint=${id}`
      await navigator.clipboard.writeText(url)
      notify('Blueprint link copied to clipboard!')
      setShareMsg('Link copied!')
    } catch {
      notify('Could not share blueprint — try again.')
      setShareMsg('Failed')
    }
    setSharing(false)
  }

  const chipBase = {
    fontFamily: 'var(--cc-font-mono)',
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    padding: '3px 10px',
    borderRadius: 4,
    background: 'transparent',
    cursor: 'pointer',
  }

  return (
    <div style={{ padding: '16px 16px 20px' }}>
      {/* Tab row + header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
          <span style={{
            fontFamily: 'var(--cc-font-mono)', fontSize: 10, letterSpacing: 1.2,
            textTransform: 'uppercase', padding: '3px 10px', borderRadius: 4,
            border: '1px solid var(--cc-mint)', color: 'var(--cc-mint)',
            background: 'rgba(100,220,200,0.08)',
          }}>
            Configure
          </span>
          <button
            type="button"
            className="cc-btn"
            onClick={() => { setBuilderOpen(true); onClose() }}
            style={{
              ...chipBase,
              border: '1px solid var(--cc-panel-divider)',
              color: 'var(--cc-text-muted)',
            }}
            title="Switch to the pixel drawing tool"
          >
            ✎ Draw
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{
            fontFamily: 'var(--cc-font-mono)', fontSize: 11,
            letterSpacing: 1.6, textTransform: 'uppercase',
            color: 'var(--cc-text-muted)', margin: 0,
          }}>
            {step === 'pick' ? 'Pick a base species' : 'Configure variant'}
          </h2>
          {step === 'configure' && (
            <button
              type="button"
              className="cc-btn"
              onClick={() => setStep('pick')}
              style={{ ...chipBase, border: '1px solid var(--cc-panel-divider)', color: 'var(--cc-text-muted)' }}
            >
              ← Back
            </button>
          )}
        </div>
      </div>

      {step === 'pick' && (
        <>
          <p style={{ fontSize: 12, color: 'var(--cc-text-muted)', marginBottom: 12 }}>
            Pick a species as your starting point. You&apos;ll be able to rename it and adjust all of its traits.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {displayList.map(bp => (
              <button
                key={bp.id}
                type="button"
                className="cc-btn"
                onClick={() => pickBase(bp)}
                style={{
                  display: 'block', textAlign: 'left',
                  padding: '8px 12px',
                  border: '1px solid var(--cc-mint-line)',
                  borderRadius: 6, background: 'transparent', cursor: 'pointer',
                }}
              >
                <div style={{
                  fontFamily: 'var(--cc-font-mono)', fontSize: 11,
                  letterSpacing: 1.2, textTransform: 'uppercase',
                  color: 'var(--cc-mint)', marginBottom: 2,
                }}>
                  {bp.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--cc-text-muted)' }}>
                  {bp.move.kind} · {bp.diet.eats.join('/')}
                </div>
              </button>
            ))}
            {displayList.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--cc-text-muted)' }}>
                No species in the world yet. Place some creatures first.
              </p>
            )}
          </div>
        </>
      )}

      {step === 'configure' && base && (
        <>
          {/* Name */}
          <div style={{ marginBottom: 14 }}>
            <label style={{
              display: 'block',
              fontFamily: 'var(--cc-font-mono)', fontSize: 10,
              letterSpacing: 1.2, textTransform: 'uppercase',
              color: 'var(--cc-text-muted)', marginBottom: 4,
            }}>
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setNameError(false) }}
              maxLength={32}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${nameError ? '#ef4444' : 'var(--cc-panel-divider)'}`,
                borderRadius: 4, color: 'var(--cc-text-main)',
                fontFamily: 'var(--cc-font-mono)', fontSize: 12,
                padding: '6px 10px', outline: 'none', boxSizing: 'border-box',
              }}
              placeholder="Name your creature"
            />
            {nameError && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>Name cannot be empty</div>}
          </div>

          {/* Locomotion kind */}
          <div style={{ marginBottom: 12 }}>
            <div style={{
              fontFamily: 'var(--cc-font-mono)', fontSize: 10,
              letterSpacing: 1.2, textTransform: 'uppercase',
              color: 'var(--cc-text-muted)', marginBottom: 6,
            }}>
              Locomotion
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {LOCO_KINDS.map(k => (
                <button
                  key={k}
                  type="button"
                  className="cc-btn"
                  onClick={() => setLocoKind(k)}
                  style={{
                    ...chipBase,
                    border: `1px solid ${locoKind === k ? 'var(--cc-mint)' : 'var(--cc-panel-divider)'}`,
                    color: locoKind === k ? 'var(--cc-mint)' : 'var(--cc-text-muted)',
                  }}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          {/* Diet */}
          <div style={{ marginBottom: 12 }}>
            <div style={{
              fontFamily: 'var(--cc-font-mono)', fontSize: 10,
              letterSpacing: 1.2, textTransform: 'uppercase',
              color: 'var(--cc-text-muted)', marginBottom: 6,
            }}>
              Diet
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {DIET_OPTIONS.map((opt, i) => (
                <button
                  key={opt.label}
                  type="button"
                  className="cc-btn"
                  onClick={() => setDietIdx(i)}
                  style={{
                    ...chipBase,
                    border: `1px solid ${dietIdx === i ? 'var(--cc-mint)' : 'var(--cc-panel-divider)'}`,
                    color: dietIdx === i ? 'var(--cc-mint)' : 'var(--cc-text-muted)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Hue + Shade + Color preview */}
          <div style={{ marginBottom: 14 }}>
            <div style={{
              fontFamily: 'var(--cc-font-mono)', fontSize: 10,
              letterSpacing: 1.2, textTransform: 'uppercase',
              color: 'var(--cc-text-muted)', marginBottom: 6,
            }}>
              Color
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 28, height: 28, borderRadius: 4,
                  background: traitColor(hue, shade),
                  border: '1px solid rgba(255,255,255,0.15)',
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: 'var(--cc-text-muted)', marginBottom: 2 }}>Hue</div>
                <input
                  type="range" min={0} max={359} step={1} value={hue}
                  onChange={e => setHue(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: 'var(--cc-text-muted)', marginBottom: 2 }}>Shade</div>
                <input
                  type="range" min={0.82} max={1.18} step={0.01} value={shade}
                  onChange={e => setShade(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>

          {/* Trait sliders */}
          <div style={{ marginBottom: 14 }}>
            <div style={{
              fontFamily: 'var(--cc-font-mono)', fontSize: 10,
              letterSpacing: 1.2, textTransform: 'uppercase',
              color: 'var(--cc-text-muted)', marginBottom: 8,
            }}>
              Traits
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {TRAIT_DEFS.map(def => (
                <div key={def.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 88, fontSize: 11, color: 'var(--cc-text-muted)',
                    fontFamily: 'var(--cc-font-mono)', flexShrink: 0,
                  }}>
                    {def.label}
                  </div>
                  <input
                    type="range"
                    min={def.min}
                    max={def.max}
                    step={def.step}
                    value={(traits[def.key] as number) ?? def.neutral}
                    onChange={e => setTrait(def.key, Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <div style={{
                    width: 36, textAlign: 'right',
                    fontSize: 11, color: 'var(--cc-text-muted)',
                    fontFamily: 'var(--cc-font-mono)', flexShrink: 0,
                  }}>
                    {((traits[def.key] as number) ?? def.neutral).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Spawn button */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="cc-btn"
              onClick={onClose}
              style={{
                ...chipBase,
                border: '1px solid var(--cc-panel-divider)',
                color: 'var(--cc-text-muted)',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="cc-btn"
              onClick={() => void handleShare()}
              disabled={sharing}
              title="Share this design — copies a link to clipboard"
              style={{
                ...chipBase,
                border: '1px solid var(--cc-panel-divider)',
                color: shareMsg === 'Link copied!' ? 'var(--cc-mint)' : 'var(--cc-text-muted)',
                opacity: sharing ? 0.5 : 1,
              }}
            >
              {sharing ? 'Sharing…' : shareMsg ?? 'Share link'}
            </button>
            <button
              type="button"
              className="cc-btn"
              onClick={handleSpawn}
              style={{
                ...chipBase,
                border: '1px solid var(--cc-mint)',
                color: 'var(--cc-mint)',
                padding: '6px 16px',
              }}
            >
              Create & Spawn 5
            </button>
          </div>
        </>
      )}

      {step === 'pick' && (
        <button
          type="button"
          className="cc-btn"
          onClick={onClose}
          style={{
            marginTop: 14,
            ...chipBase,
            border: '1px solid var(--cc-panel-divider)',
            color: 'var(--cc-text-muted)',
          }}
        >
          Close
        </button>
      )}
    </div>
  )
}

export function BlueprintWorkshop() {
  const open = useMicroLand(s => s.workshopOpen)
  const setWorkshopOpen = useMicroLand(s => s.setWorkshopOpen)

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflowY: 'auto',
      }}
      onClick={() => setWorkshopOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Blueprint Workshop"
        style={{
          background: 'var(--cc-panel-bg)',
          border: '1px solid var(--cc-panel-divider)',
          borderRadius: 8,
          maxWidth: 460,
          width: '90vw',
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        <WorkshopPane onClose={() => setWorkshopOpen(false)} />
      </div>
    </div>
  )
}
