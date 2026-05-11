import {
  GhostButton,
  PrimaryButton,
} from '@/app/comet-cards/components/cosmic/buttons'
import { Panel } from '@/app/comet-cards/components/cosmic/panel'
import { eventEmitter } from '@/app/comet-cards/domain/events/event-emitter'
import { implementedTags as tags } from '@/app/comet-cards/domain/tag/tags'
import type { TagType } from '@/app/comet-cards/domain/tag/types'

const BLIND_ACCENT: Record<string, string> = {
  SMALL_BLIND_SELECTED: 'var(--cc-mint)',
  BIG_BLIND_SELECTED: 'var(--cc-gold)',
  BOSS_BLIND_SELECTED: 'var(--cc-pink)',
}

export function BlindCard({
  name,
  description,
  reward,
  minimumScore,
  disabled,
  selectEventName,
  tag,
}: {
  name: string
  description?: string
  reward: number
  minimumScore?: bigint
  disabled: boolean
  selectEventName: 'SMALL_BLIND_SELECTED' | 'BIG_BLIND_SELECTED' | 'BOSS_BLIND_SELECTED'
  tag?: TagType
}) {
  const accent = BLIND_ACCENT[selectEventName] ?? 'var(--cc-mint)'
  const eyebrow = selectEventName === 'BOSS_BLIND_SELECTED' ? 'Boss Blind' : 'Blind'

  return (
    <Panel className="flex w-full flex-col" title={eyebrow}>
      <div
        className="flex flex-col"
        style={{
          padding: '18px 18px 14px',
          gap: 8,
          opacity: disabled ? 0.5 : 1,
          transition: 'opacity 200ms',
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: -0.3,
            color: accent,
          }}
        >
          {name}
        </div>
        {description && (
          <div
            style={{
              fontSize: 12,
              opacity: 0.7,
              lineHeight: 1.5,
            }}
          >
            {description}
          </div>
        )}

        <div
          className="flex items-center justify-between"
          style={{
            marginTop: 10,
            padding: '10px 12px',
            borderRadius: 6,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(94,234,212,0.1)',
          }}
        >
          <span
            className="uppercase"
            style={{
              fontFamily: 'var(--cc-font-mono)',
              fontSize: 10,
              letterSpacing: 1.5,
              opacity: 0.55,
            }}
          >
            Reward
          </span>
          <span
            style={{
              fontFamily: 'var(--cc-font-mono)',
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--cc-gold)',
            }}
          >
            ${reward}
          </span>
        </div>

        {minimumScore !== undefined && (
          <div
            className="flex items-center justify-between"
            style={{
              padding: '10px 12px',
              borderRadius: 6,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(94,234,212,0.1)',
            }}
          >
            <span
              className="uppercase"
              style={{
                fontFamily: 'var(--cc-font-mono)',
                fontSize: 10,
                letterSpacing: 1.5,
                opacity: 0.55,
              }}
            >
              Score at Least
            </span>
            <span
              style={{
                fontFamily: 'var(--cc-font-mono)',
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--cc-pink)',
              }}
            >
              {minimumScore.toString()}
            </span>
          </div>
        )}
      </div>

      <div
        className="flex flex-col"
        style={{
          gap: 8,
          padding: '10px 18px 18px',
          borderTop: '1px solid var(--cc-panel-divider)',
        }}
      >
        <PrimaryButton
          className="w-full"
          style={{ width: '100%' }}
          disabled={disabled}
          onClick={() => eventEmitter.emit({ type: selectEventName })}
        >
          Select
        </PrimaryButton>
        {tag && (
          <>
            <GhostButton
              style={{ width: '100%' }}
              disabled={disabled}
              onClick={() => eventEmitter.emit({ type: 'BLIND_SKIPPED' })}
            >
              Skip · Get {tags[tag]?.name} Tag
            </GhostButton>
            <div
              style={{
                fontSize: 11,
                opacity: 0.6,
                lineHeight: 1.45,
              }}
            >
              <strong style={{ color: 'var(--cc-mint)' }}>{tags[tag]?.name}</strong>:{' '}
              {tags[tag]?.benefit}
            </div>
          </>
        )}
      </div>
    </Panel>
  )
}
