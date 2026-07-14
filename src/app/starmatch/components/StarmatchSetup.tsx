'use client'

import { DIFFS, DIFF_ORDER, type DiffKey, MAX_PLAYERS } from '@/app/starmatch/lib/glyphs'
import { type StarmatchState, TARGET_OPTIONS } from '@/app/starmatch/useStarmatch'
import { ChunkyButton } from '@/components/ui/chunky-button'
import { ChunkyCard, ChunkyCardContent } from '@/components/ui/chunky-card'
import { Pill } from '@/components/ui/pill'
import { cn } from '@/lib/utils'


interface SetupProps {
  state: StarmatchState
  onSetDiff: (d: DiffKey) => void
  onSetTarget: (t: number) => void
  onAddPlayer: () => void
  onRemovePlayer: (id: number) => void
  onRenamePlayer: (id: number, name: string) => void
  onCycleLook: (id: number) => void
  onStart: () => void
}

function SegButton({
  active,
  onClick,
  title,
  sub,
}: {
  active: boolean
  onClick: () => void
  title: string
  sub: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex-1 min-w-[92px] rounded-ds-sm border-2 px-3 py-2.5 text-center transition-all duration-100',
        active
          ? 'bg-primary-container text-on-primary-container border-transparent shadow-button-sm'
          : 'bg-surface-container-high text-on-surface border-outline-variant/40 hover:border-outline-variant'
      )}
    >
      <span className="block font-headline font-bold text-base leading-tight">{title}</span>
      <span
        className={cn(
          'block text-xs mt-0.5',
          active ? 'text-on-primary-container/80' : 'text-on-surface-variant/70'
        )}
      >
        {sub}
      </span>
    </button>
  )
}

export function StarmatchSetup({
  state,
  onSetDiff,
  onSetTarget,
  onAddPlayer,
  onRemovePlayer,
  onRenamePlayer,
  onCycleLook,
  onStart,
}: SetupProps) {
  const solo = state.players.length === 1

  return (
    <div className="flex flex-col items-center gap-8 py-6">
      {/* Brand */}
      <div className="text-center max-w-2xl">
        <Pill tone="info" icon="hub" className="mb-4">
          Spot the twin
        </Pill>
        <h1 className="font-headline text-headline-lg text-on-surface drop-shadow-[0_4px_0_var(--surface-container-lowest)]">
          Star<span className="text-ds-primary">match</span>
        </h1>
        <p className="mt-3 text-body-lg text-on-surface-variant">
          Two star charts drift into view. Exactly one sign is shared between them — trace it before
          anyone else and the point is yours.
        </p>
      </div>

      {/* Voyagers */}
      <ChunkyCard variant="surface-variant" className="w-full max-w-2xl" cornerGlow="primary">
        <ChunkyCardContent className="pt-6 pb-6">
          <h2 className="font-label uppercase tracking-widest text-sm text-on-surface-variant mb-4 flex items-center gap-2">
            Voyagers
            <span className="text-ds-tertiary tabular-nums">({state.players.length})</span>
          </h2>

          <div className="flex flex-col gap-2.5">
            {state.players.map((p, i) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-ds-sm bg-surface-container-high/60 border border-outline-variant/30 px-2.5 py-2"
              >
                <button
                  type="button"
                  onClick={() => onCycleLook(p.id)}
                  title="Change sigil & color"
                  aria-label={`Change ${p.name}'s sigil and color`}
                  className="flex-none grid place-items-center w-12 h-12 rounded-full text-2xl shadow-button-sm active:translate-y-[2px]"
                  style={{ backgroundColor: p.color, color: 'var(--sm-ink)' }}
                >
                  {p.glyph}
                </button>
                <span className="flex-none grid place-items-center w-8 h-8 rounded-md font-mono font-bold text-sm bg-surface-container-lowest text-on-surface-variant border border-outline-variant/40">
                  {i + 1}
                </span>
                <input
                  type="text"
                  value={p.name}
                  maxLength={16}
                  aria-label={`Voyager ${i + 1} name`}
                  onChange={(e) => onRenamePlayer(p.id, e.target.value)}
                  className="flex-1 min-w-0 bg-transparent border-0 outline-none text-on-surface font-body font-semibold text-lg focus:border-b-2 focus:border-ds-tertiary py-1"
                />
                {state.players.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemovePlayer(p.id)}
                    aria-label={`Remove ${p.name}`}
                    className="flex-none grid place-items-center w-9 h-9 rounded-md bg-surface-container-lowest text-on-surface-variant hover:bg-error-container hover:text-on-error-container transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]" aria-hidden>
                      close
                    </span>
                  </button>
                )}
              </div>
            ))}
          </div>

          {state.players.length < MAX_PLAYERS && (
            <ChunkyButton
              variant="ghost"
              size="md"
              onClick={onAddPlayer}
              className="mt-3"
              iconStart={
                <span className="material-symbols-outlined text-[20px]" aria-hidden>
                  add
                </span>
              }
            >
              Add voyager
            </ChunkyButton>
          )}
        </ChunkyCardContent>
      </ChunkyCard>

      {/* Match setup */}
      <ChunkyCard variant="surface-variant" className="w-full max-w-2xl" cornerGlow="secondary">
        <ChunkyCardContent className="pt-6 pb-6 flex flex-col gap-6">
          <div>
            <div className="font-label uppercase tracking-widest text-xs text-on-surface-variant mb-2.5">
              Chart density — signs per chart
            </div>
            <div className="flex gap-2 flex-wrap">
              {DIFF_ORDER.map((key) => (
                <SegButton
                  key={key}
                  active={state.diff === key}
                  onClick={() => onSetDiff(key)}
                  title={DIFFS[key].label}
                  sub={`${DIFFS[key].sym} signs`}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="font-label uppercase tracking-widest text-xs text-on-surface-variant mb-2.5">
              Play to
            </div>
            <div className="flex gap-2 flex-wrap">
              {TARGET_OPTIONS.map((t) => (
                <SegButton
                  key={t.value}
                  active={state.target === t.value}
                  onClick={() => onSetTarget(t.value)}
                  title={t.value === 0 ? '∞' : String(t.value)}
                  sub={t.label}
                />
              ))}
            </div>
          </div>
        </ChunkyCardContent>
      </ChunkyCard>

      <ChunkyButton
        variant="primary"
        size="hero"
        onClick={onStart}
        iconEnd={
          <span className="material-symbols-outlined text-[22px]" aria-hidden>
            play_circle
          </span>
        }
      >
        Open the charts
      </ChunkyButton>

      <p className="text-sm text-on-surface-variant/70 text-center max-w-lg">
        {solo
          ? 'Solo drift — just trace the shared sign as fast as you can.'
          : 'Buzz in with your number key (or tap your sigil), then trace the shared sign. A wrong trace sits you out for the round.'}
      </p>
    </div>
  )
}
