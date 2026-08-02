'use client'

import { useMemo, useState } from 'react'

import { GhostButton, PrimaryButton } from '@/app/comet-cards/components/cosmic/buttons'
import { decks } from '@/app/comet-cards/domain/decks/decks'
import { eventEmitter } from '@/app/comet-cards/domain/events/event-emitter'
import type { JokerState } from '@/app/comet-cards/domain/joker/types'
import type { TagType } from '@/app/comet-cards/domain/tag/types'
import type { VoucherType } from '@/app/comet-cards/domain/voucher/types'
import { useCometCardsStore } from '@/app/comet-cards/store'

import { CollapsibleSection } from './CollapsibleSection'
import {
  type SandboxConfig,
  buildSandboxState,
  defaultSandboxConfig,
  listBossBlindOptions,
  listJokerOptions,
  listTagOptions,
  listVoucherOptions,
} from './seed'
import { Tooltip } from './Tooltip'
import { type ValidationKind, type ValidationStatus, useValidations } from './useValidations'

const VALIDATED_PILL: React.CSSProperties = {
  borderColor: 'rgba(94,234,212,0.65)',
  boxShadow: '0 0 0 1px rgba(94,234,212,0.25) inset',
}

const FAILED_PILL: React.CSSProperties = {
  borderColor: 'rgba(255,107,157,0.65)',
  boxShadow: '0 0 0 1px rgba(255,107,157,0.25) inset',
}

const STATUS_PILL_STYLE: Record<ValidationStatus, React.CSSProperties> = {
  validated: VALIDATED_PILL,
  failed: FAILED_PILL,
}

const STATUS_PREFIX: Record<ValidationStatus, string> = {
  validated: '✓ ',
  failed: '✗ ',
}

const VALIDATE_LINK_BASE: React.CSSProperties = {
  display: 'inline-block',
  fontFamily: 'var(--cc-font-mono)',
  fontSize: 10,
  letterSpacing: 1,
  textTransform: 'uppercase',
  padding: '4px 8px',
  borderRadius: 4,
  border: '1px solid',
  background: 'transparent',
  cursor: 'pointer',
}

function StatusButtons({
  status,
  onSet,
}: {
  status: ValidationStatus | undefined
  onSet: (s: ValidationStatus) => void
}) {
  const validated = status === 'validated'
  const failed = status === 'failed'
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
      <button
        type="button"
        onClick={e => {
          e.stopPropagation()
          onSet('validated')
        }}
        style={{
          ...VALIDATE_LINK_BASE,
          color: 'var(--cc-mint)',
          borderColor: 'rgba(94,234,212,0.35)',
          background: validated ? 'rgba(94,234,212,0.18)' : 'transparent',
        }}
      >
        {validated ? '✓ Validated · Unmark' : '✓ Mark validated'}
      </button>
      <button
        type="button"
        onClick={e => {
          e.stopPropagation()
          onSet('failed')
        }}
        style={{
          ...VALIDATE_LINK_BASE,
          color: 'var(--cc-pink)',
          borderColor: 'rgba(255,107,157,0.35)',
          background: failed ? 'rgba(255,107,157,0.18)' : 'transparent',
        }}
      >
        {failed ? '✗ Failed · Unmark' : '✗ Mark failed'}
      </button>
    </div>
  )
}

const SECTION_LABEL: React.CSSProperties = {
  fontFamily: 'var(--cc-font-mono)',
  fontSize: 10,
  letterSpacing: 2,
  textTransform: 'uppercase',
  opacity: 0.55,
  marginBottom: 6,
}

const INPUT_BASE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid var(--cc-panel-divider)',
  borderRadius: 4,
  color: 'var(--cc-text-default)',
  fontFamily: 'var(--cc-font-mono)',
  fontSize: 12,
  padding: '6px 8px',
  width: '100%',
}

const PILL_BASE: React.CSSProperties = {
  fontFamily: 'var(--cc-font-mono)',
  fontSize: 10,
  letterSpacing: 1,
  textTransform: 'uppercase',
  padding: '4px 8px',
  borderRadius: 999,
  border: '1px solid rgba(94,234,212,0.25)',
  background: 'transparent',
  color: 'var(--cc-mint)',
  cursor: 'pointer',
}

const PILL_REMOVE: React.CSSProperties = {
  ...PILL_BASE,
  color: 'var(--cc-pink)',
  borderColor: 'rgba(255,107,157,0.35)',
  background: 'rgba(255,107,157,0.08)',
}

const EDITION_OPTIONS: JokerState['edition'][] = [
  'normal',
  'foil',
  'holographic',
  'polychrome',
  'negative',
]

export function SandboxPanel() {
  const setGame = useCometCardsStore(state => state.setGame)
  const clearGame = useCometCardsStore(state => state.clearGame)
  const game = useCometCardsStore(state => state.game)

  const [config, setConfig] = useState<SandboxConfig>(defaultSandboxConfig)
  const [jokerSearch, setJokerSearch] = useState('')

  const { getStatus, setStatus, counts: validatedCounts, clearKind } = useValidations()

  const subtitleFor = (kind: ValidationKind, total: number) => {
    const c = validatedCounts[kind]
    return `${c.validated}✓ · ${c.failed}✗ / ${total}`
  }

  const jokerOptions = useMemo(() => listJokerOptions(), [])
  const voucherOptions = useMemo(() => listVoucherOptions(), [])
  const tagOptions = useMemo(() => listTagOptions(), [])
  const bossOptions = useMemo(() => listBossBlindOptions(), [])

  const filteredJokerOptions = useMemo(() => {
    const q = jokerSearch.trim().toLowerCase()
    if (!q) return jokerOptions
    return jokerOptions.filter(j => j.name.toLowerCase().includes(q))
  }, [jokerOptions, jokerSearch])

  const apply = () => {
    setGame(buildSandboxState(config))
  }

  const applyAndStart = (blindEvent: 'SMALL_BLIND_SELECTED' | 'BIG_BLIND_SELECTED' | 'BOSS_BLIND_SELECTED') => {
    const next = buildSandboxState(config)
    if (blindEvent === 'BIG_BLIND_SELECTED' || blindEvent === 'BOSS_BLIND_SELECTED') {
      next.rounds[next.roundIndex].smallBlind.status = 'completed'
    }
    if (blindEvent === 'BOSS_BLIND_SELECTED') {
      next.rounds[next.roundIndex].bigBlind.status = 'completed'
    }
    setGame(next)
    queueMicrotask(() => eventEmitter.emit({ type: blindEvent }))
  }

  const update = <K extends keyof SandboxConfig>(key: K, value: SandboxConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  const addJoker = (id: string) => {
    if (config.jokerIds.includes(id)) return
    update('jokerIds', [...config.jokerIds, id])
  }

  const removeJoker = (id: string) => {
    update('jokerIds', config.jokerIds.filter(j => j !== id))
  }

  const toggleVoucher = (type: VoucherType) => {
    update(
      'vouchers',
      config.vouchers.includes(type)
        ? config.vouchers.filter(v => v !== type)
        : [...config.vouchers, type]
    )
  }

  const toggleTag = (type: TagType) => {
    update(
      'tags',
      config.tags.includes(type)
        ? config.tags.filter(t => t !== type)
        : [...config.tags, type]
    )
  }

  const isLive = game.gamePhase === 'gameplay' || game.gamePhase === 'blindSelection'

  return (
    <div className="flex flex-col gap-4">
      <CollapsibleSection title="Sandbox">
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="flex flex-wrap gap-2">
            <PrimaryButton onClick={apply}>Apply</PrimaryButton>
            <PrimaryButton onClick={() => applyAndStart('SMALL_BLIND_SELECTED')}>
              Start Small
            </PrimaryButton>
            <PrimaryButton onClick={() => applyAndStart('BIG_BLIND_SELECTED')}>
              Start Big
            </PrimaryButton>
            <PrimaryButton onClick={() => applyAndStart('BOSS_BLIND_SELECTED')}>
              Start Boss
            </PrimaryButton>
            <GhostButton
              onClick={() => {
                clearGame()
                setConfig(defaultSandboxConfig)
              }}
            >
              Reset
            </GhostButton>
          </div>
          <div
            style={{
              fontFamily: 'var(--cc-font-mono)',
              fontSize: 10,
              opacity: 0.55,
              lineHeight: 1.5,
            }}
          >
            Apply rebuilds state from config; Start * also dispatches the chosen blind event.{' '}
            {isLive ? 'Game is live.' : 'No blind in progress.'}
          </div>

          <div
            style={{
              borderTop: '1px solid var(--cc-panel-divider)',
              paddingTop: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--cc-font-mono)',
                fontSize: 10,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                opacity: 0.7,
                lineHeight: 1.6,
              }}
            >
              <div>
                <span style={{ color: 'var(--cc-mint)' }}>✓</span>{' '}
                {validatedCounts.joker.validated}j ·{' '}
                {validatedCounts.voucher.validated}v ·{' '}
                {validatedCounts.tag.validated}t ·{' '}
                {validatedCounts.bossBlind.validated}b
              </div>
              <div>
                <span style={{ color: 'var(--cc-pink)' }}>✗</span>{' '}
                {validatedCounts.joker.failed}j ·{' '}
                {validatedCounts.voucher.failed}v ·{' '}
                {validatedCounts.tag.failed}t ·{' '}
                {validatedCounts.bossBlind.failed}b
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {(['joker', 'voucher', 'tag', 'bossBlind'] as ValidationKind[]).map(kind => {
                const c = validatedCounts[kind]
                if (c.validated + c.failed === 0) return null
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => clearKind(kind)}
                    style={{
                      ...VALIDATE_LINK_BASE,
                      color: 'var(--cc-pink)',
                      borderColor: 'rgba(255,107,157,0.35)',
                    }}
                  >
                    Clear {kind}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Run Variables">
        <div
          style={{
            padding: 14,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
          }}
        >
          <Field label="Deck">
            <select
              style={INPUT_BASE}
              value={config.deckId}
              onChange={e => update('deckId', e.target.value)}
            >
              {Object.values(decks).map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ante (round index)">
            <input
              type="number"
              min={0}
              style={INPUT_BASE}
              value={config.ante}
              onChange={e => update('ante', Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="Money">
            <input
              type="number"
              style={INPUT_BASE}
              value={config.money}
              onChange={e => update('money', Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="Max Jokers">
            <input
              type="number"
              min={1}
              style={INPUT_BASE}
              value={config.maxJokers}
              onChange={e => update('maxJokers', Number(e.target.value) || 1)}
            />
          </Field>
          <Field label="Hands">
            <input
              type="number"
              min={1}
              style={INPUT_BASE}
              value={config.maxHands}
              onChange={e => update('maxHands', Number(e.target.value) || 1)}
            />
          </Field>
          <Field label="Discards">
            <input
              type="number"
              min={0}
              style={INPUT_BASE}
              value={config.maxDiscards}
              onChange={e => update('maxDiscards', Number(e.target.value) || 0)}
            />
          </Field>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Boss Blind"
        subtitle={subtitleFor('bossBlind', bossOptions.length)}
      >
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <select
            style={INPUT_BASE}
            value={config.forcedBossBlindName ?? ''}
            onChange={e =>
              update('forcedBossBlindName', e.target.value || undefined)
            }
          >
            <option value="">— Random (per ante) —</option>
            {bossOptions.map(b => {
              const status = getStatus('bossBlind', b.name)
              const prefix = status ? STATUS_PREFIX[status] : ''
              return (
                <option key={b.name} value={b.name}>
                  {prefix}
                  {b.name} (min ante {b.minimumAnte})
                </option>
              )
            })}
          </select>
          {config.forcedBossBlindName && (
            <>
              <div style={{ fontSize: 11, opacity: 0.7, lineHeight: 1.5 }}>
                {bossOptions.find(b => b.name === config.forcedBossBlindName)?.description}
              </div>
              <StatusButtons
                status={getStatus('bossBlind', config.forcedBossBlindName)}
                onSet={status =>
                  setStatus('bossBlind', config.forcedBossBlindName!, status)
                }
              />
            </>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={`Jokers (${config.jokerIds.length})`}
        subtitle={subtitleFor('joker', jokerOptions.length)}
      >
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="flex items-center gap-2">
            <input
              aria-label="Search jokers"
              placeholder="Search jokers…"
              style={INPUT_BASE}
              value={jokerSearch}
              onChange={e => setJokerSearch(e.target.value)}
            />
            <select
              style={{ ...INPUT_BASE, width: 130 }}
              value={config.jokerEdition}
              onChange={e =>
                update('jokerEdition', e.target.value as JokerState['edition'])
              }
            >
              {EDITION_OPTIONS.map(ed => (
                <option key={ed} value={ed}>
                  {ed}
                </option>
              ))}
            </select>
          </div>
          {config.jokerIds.length > 0 && (
            <div>
              <div style={SECTION_LABEL}>Selected</div>
              <div className="flex flex-wrap gap-1">
                {config.jokerIds.map(id => {
                  const j = jokerOptions.find(o => o.id === id)
                  const status = getStatus('joker', id)
                  const tip = j ? (
                    <span>
                      <strong style={{ color: 'var(--cc-mint)' }}>{j.name}</strong>
                      <span style={{ opacity: 0.55, marginLeft: 6 }}>· {j.rarity}</span>
                      <div style={{ marginTop: 4 }}>{j.description}</div>
                      <StatusButtons
                        status={status}
                        onSet={s => setStatus('joker', id, s)}
                      />
                    </span>
                  ) : (
                    id
                  )
                  return (
                    <Tooltip key={id} content={tip} side="left">
                      <button
                        type="button"
                        onClick={() => removeJoker(id)}
                        style={{
                          ...PILL_REMOVE,
                          ...(status ? STATUS_PILL_STYLE[status] : null),
                        }}
                        title="Remove"
                      >
                        {status ? STATUS_PREFIX[status] : ''}
                        {j?.name ?? id} ×
                      </button>
                    </Tooltip>
                  )
                })}
              </div>
            </div>
          )}
          <div>
            <div style={SECTION_LABEL}>
              Available ({filteredJokerOptions.length}/{jokerOptions.length})
            </div>
            <div
              className="flex flex-wrap gap-1"
              style={{
                maxHeight: 280,
                overflowY: 'auto',
                paddingRight: 4,
              }}
            >
              {filteredJokerOptions.map(j => {
                const selected = config.jokerIds.includes(j.id)
                const status = getStatus('joker', j.id)
                const tip = (
                  <span>
                    <strong style={{ color: 'var(--cc-mint)' }}>{j.name}</strong>
                    <span style={{ opacity: 0.55, marginLeft: 6 }}>· {j.rarity}</span>
                    <div style={{ marginTop: 4 }}>{j.description}</div>
                    <StatusButtons
                      status={status}
                      onSet={s => setStatus('joker', j.id, s)}
                    />
                  </span>
                )
                return (
                  <Tooltip key={j.id} content={tip} side="left">
                    <button
                      type="button"
                      disabled={selected}
                      onClick={() => addJoker(j.id)}
                      style={{
                        ...PILL_BASE,
                        ...(status ? STATUS_PILL_STYLE[status] : null),
                        opacity: selected ? 0.35 : 1,
                        cursor: selected ? 'default' : 'pointer',
                      }}
                    >
                      {status ? STATUS_PREFIX[status] : '+ '}
                      {j.name}
                    </button>
                  </Tooltip>
                )
              })}
            </div>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={`Vouchers (${config.vouchers.length})`}
        subtitle={subtitleFor('voucher', voucherOptions.length)}
        defaultOpen={false}
      >
        <div className="flex flex-wrap gap-1" style={{ padding: 14 }}>
          {voucherOptions.map(v => {
            const selected = config.vouchers.includes(v.type)
            const status = getStatus('voucher', v.type)
            const tip = (
              <span>
                <strong style={{ color: 'var(--cc-mint)' }}>{v.name}</strong>
                <div style={{ marginTop: 4 }}>{v.description}</div>
                <StatusButtons
                  status={status}
                  onSet={s => setStatus('voucher', v.type, s)}
                />
              </span>
            )
            const prefix = status ? STATUS_PREFIX[status] : selected ? '● ' : '+ '
            return (
              <Tooltip key={v.type} content={tip} side="left">
                <button
                  type="button"
                  onClick={() => toggleVoucher(v.type)}
                  style={{
                    ...PILL_BASE,
                    ...(status ? STATUS_PILL_STYLE[status] : null),
                    background: selected ? 'rgba(94,234,212,0.18)' : 'transparent',
                  }}
                >
                  {prefix}
                  {v.name}
                </button>
              </Tooltip>
            )
          })}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={`Tags (${config.tags.length})`}
        subtitle={subtitleFor('tag', tagOptions.length)}
        defaultOpen={false}
      >
        <div className="flex flex-wrap gap-1" style={{ padding: 14 }}>
          {tagOptions.map(t => {
            const selected = config.tags.includes(t.type)
            const status = getStatus('tag', t.type)
            const tip = (
              <span>
                <strong style={{ color: 'var(--cc-mint)' }}>{t.name}</strong>
                <div style={{ marginTop: 4 }}>{t.benefit}</div>
                <StatusButtons
                  status={status}
                  onSet={s => setStatus('tag', t.type, s)}
                />
              </span>
            )
            const prefix = status ? STATUS_PREFIX[status] : selected ? '● ' : '+ '
            return (
              <Tooltip key={t.type} content={tip} side="left">
                <button
                  type="button"
                  onClick={() => toggleTag(t.type)}
                  style={{
                    ...PILL_BASE,
                    ...(status ? STATUS_PILL_STYLE[status] : null),
                    background: selected ? 'rgba(94,234,212,0.18)' : 'transparent',
                  }}
                >
                  {prefix}
                  {t.name}
                </button>
              </Tooltip>
            )
          })}
        </div>
      </CollapsibleSection>

      <ScoringFeed />
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col" style={{ gap: 4 }}>
      <span style={SECTION_LABEL}>{label}</span>
      {children}
    </label>
  )
}

function ScoringFeed() {
  const events = useCometCardsStore(state => state.game.gamePlayState.scoringEvents)
  if (events.length === 0) {
    return null
  }
  return (
    <CollapsibleSection title={`Scoring Feed (${events.length})`}>
      <div
        className="flex flex-col gap-1"
        style={{
          padding: '10px 14px',
          fontFamily: 'var(--cc-font-mono)',
          fontSize: 11,
          maxHeight: 240,
          overflowY: 'auto',
        }}
      >
        {events.map(event => {
          if ('message' in event) {
            return (
              <div key={event.id} style={{ opacity: 0.75 }}>
                {event.message}
              </div>
            )
          }
          const sign = event.operator ?? '+'
          const isMult = event.type === 'mult'
          return (
            <div key={event.id} className="flex items-center justify-between gap-2">
              <span style={{ opacity: 0.6 }}>{event.source}</span>
              <span style={{ color: isMult ? 'var(--cc-pink)' : 'var(--cc-mint)' }}>
                {sign}
                {event.value} {isMult ? 'mult' : 'chips'}
              </span>
            </div>
          )
        })}
      </div>
    </CollapsibleSection>
  )
}
