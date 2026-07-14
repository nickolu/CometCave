'use client'

import styles from '@/app/starmatch/starmatch.module.css'
import type { StarmatchState } from '@/app/starmatch/useStarmatch'
import { ChunkyButton } from '@/components/ui/chunky-button'
import { cn } from '@/lib/utils'


import { RoundTimer } from './RoundTimer'
import { StarChart } from './StarChart'

interface ArenaProps {
  state: StarmatchState
  onSelect: (sym: number) => void
  onBuzz: (id: number) => void
  onReveal: () => void
  onNewPair: () => void
  onToggleMute: () => void
  onBackToSetup: () => void
  onClearShake: () => void
}

function Icon({ name }: { name: string }) {
  return (
    <span className="material-symbols-outlined text-[20px] leading-none" aria-hidden>
      {name}
    </span>
  )
}

export function StarmatchArena({
  state,
  onSelect,
  onBuzz,
  onReveal,
  onNewPair,
  onToggleMute,
  onBackToSetup,
  onClearShake,
}: ArenaProps) {
  const multi = state.players.length > 1
  const bannerTone =
    state.banner.kind === 'good'
      ? 'bg-primary-container text-on-primary-container'
      : state.banner.kind === 'bad'
        ? 'bg-error-container text-on-error-container'
        : state.banner.kind === 'claim'
          ? ''
          : 'bg-surface-container-high text-on-surface-variant'

  return (
    <div className="flex flex-col gap-4">
      {/* HUD */}
      <div className="flex flex-wrap items-center gap-3 rounded-ds-sm bg-surface-container-high border-[3px] border-surface-container-lowest px-4 py-3 shadow-card">
        <div className="flex items-baseline gap-2">
          <span
            className="font-mono tabular-nums text-3xl md:text-4xl font-bold text-ds-primary"
            aria-label="Round timer, seconds"
          >
            <RoundTimer roundStart={state.roundStart} running={!state.resolving} />
          </span>
          <span className="text-xs font-label uppercase tracking-widest text-on-surface-variant/70">
            sec
          </span>
        </div>

        <div className="text-sm text-on-surface-variant font-body">
          {state.target ? (
            <>
              First to <b className="text-ds-tertiary">{state.target}</b>
            </>
          ) : (
            'Endless drift'
          )}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ChunkyButton variant="utility" size="sm" onClick={onReveal} iconStart={<Icon name="visibility" />}>
            Reveal
          </ChunkyButton>
          <ChunkyButton variant="utility" size="sm" onClick={onNewPair} iconStart={<Icon name="shuffle" />}>
            New pair
          </ChunkyButton>
          <ChunkyButton
            variant="ghost"
            size="sm"
            onClick={onToggleMute}
            aria-label={state.muted ? 'Turn sound on' : 'Turn sound off'}
            iconStart={<Icon name={state.muted ? 'volume_off' : 'volume_up'} />}
          >
            <span className="sr-only">{state.muted ? 'Sound off' : 'Sound on'}</span>
          </ChunkyButton>
          <ChunkyButton variant="exit" size="sm" onClick={onBackToSetup} iconStart={<Icon name="restart_alt" />}>
            New match
          </ChunkyButton>
        </div>
      </div>

      {/* Claim banner */}
      <div
        className={cn(
          'min-h-[48px] flex items-center justify-center text-center gap-2 rounded-ds-sm px-4 py-2',
          'font-headline font-bold text-lg md:text-xl',
          bannerTone
        )}
        style={
          state.banner.kind === 'claim'
            ? { backgroundColor: state.banner.color, color: 'var(--sm-ink)' }
            : undefined
        }
        aria-live="polite"
      >
        {state.banner.text}
      </div>

      {/* The two star charts */}
      <div className={styles.arena}>
        <StarChart
          key={`a-${state.roundId}`}
          layout={state.layoutA}
          symGlyph={state.symGlyph}
          match={state.match}
          matchState={state.matchState}
          tone="primary"
          shaking={state.shaking}
          resolving={state.resolving}
          onSelect={onSelect}
          onClearShake={onClearShake}
        />
        <div
          className="flex-none grid place-items-center rounded-full font-headline font-extrabold text-on-primary-container bg-primary-container shadow-button-sm"
          style={{ width: 'clamp(44px,6vw,66px)', height: 'clamp(44px,6vw,66px)' }}
          aria-hidden
        >
          ⇄
        </div>
        <StarChart
          key={`b-${state.roundId}`}
          layout={state.layoutB}
          symGlyph={state.symGlyph}
          match={state.match}
          matchState={state.matchState}
          tone="secondary"
          shaking={state.shaking}
          resolving={state.resolving}
          onSelect={onSelect}
          onClearShake={onClearShake}
        />
      </div>

      {/* Player rail */}
      {multi && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {state.players.map((p, i) => {
            const active = state.activeClaimer === p.id
            const locked = state.locked[p.id]
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onBuzz(p.id)}
                disabled={locked || state.resolving}
                className={cn(
                  'flex-1 min-w-[128px] flex items-center gap-3 rounded-ds-sm px-3 py-2 text-left',
                  'border-2 transition-all duration-100',
                  'bg-surface-container-high',
                  active ? 'border-transparent -translate-y-0.5' : 'border-outline-variant/40',
                  locked && 'opacity-40 grayscale'
                )}
                style={active ? { borderColor: p.color, boxShadow: `0 8px 20px -12px ${p.color}` } : undefined}
              >
                <span
                  className="relative flex-none grid place-items-center w-11 h-11 rounded-full text-xl"
                  style={{ backgroundColor: p.color, color: 'var(--sm-ink)' }}
                >
                  {p.glyph}
                  <span className="absolute -right-1.5 -bottom-1.5 grid place-items-center w-5 h-5 rounded-md text-[11px] font-mono font-bold bg-surface-container-lowest text-on-surface border border-outline-variant/50">
                    {i + 1}
                  </span>
                </span>
                <span className="flex flex-col min-w-0 leading-tight">
                  <span className="font-headline font-bold text-sm truncate">{p.name}</span>
                  <span className="font-mono tabular-nums text-2xl font-bold" style={{ color: p.color }}>
                    {p.score}
                  </span>
                </span>
                {locked && (
                  <span className="ml-auto text-xs font-label uppercase tracking-wider text-ds-error">
                    out
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
