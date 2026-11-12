'use client'


/**
 * The town, printed as doors on a bill. The town's name is already the title
 * above (GameStage prints it), so this starts with the prompt and lists each
 * door as a line; townspeople follow a rule, and "Leave" is the quiet last line.
 */
import React from 'react'

import { getRelationshipTier } from '@/app/tap-tap-adventure/config/npcs'
import type { FantasyCharacter, FantasyDecisionPoint } from '@/app/tap-tap-adventure/models/types'
import { DoorGlyph } from '@/app/tap-tap-adventure/stage/glyphs'
import { PlaybillCaption, PlaybillLine, PlaybillRule, PrintingDots, Stamp, type StampTone } from '@/app/tap-tap-adventure/stage/Playbill'

interface TownHubProps {
  townName: string
  townIcon?: string
  decisionPoint: FantasyDecisionPoint
  isResolving: boolean
  character: FantasyCharacter
  onSelectOption: (optionId: string) => void
  statusMessage?: string | null
  npcDispositions?: Record<string, number>
}

interface FeatureConfig {
  /** The door's glyph: game data, printed as text at the left of the line. */
  icon: string
  label: string
  isDisabled?: (option: { id: string; text: string }, character: FantasyCharacter) => boolean
  disabledReason?: (option: { id: string; text: string }, character: FantasyCharacter) => string | null
}

const FEATURE_CONFIGS: Record<string, FeatureConfig> = {
  'visit-shop': { icon: '🏪', label: 'Visit Shop' },
  'rest-at-inn': { icon: '🍺', label: 'Tavern & Inn' },
  'hire-transport': { icon: '🐴', label: 'Hire Transport' },
  'visit-stable': { icon: '🐴', label: 'Visit Stable' },
  'check-mailbox': { icon: '📬', label: 'Check Mailbox' },
  'visit-notice-board': { icon: '📋', label: 'Notice Board' },
  'visit-blacksmith': { icon: '⚒️', label: 'Visit Blacksmith' },
  'visit-waypoints': { icon: '🗺️', label: 'Waypoints' },
}

const TIER_TONE: Record<string, StampTone> = {
  hostile: 'red',
  unfriendly: 'gold',
  neutral: 'ink',
  friendly: 'green',
  trusted: 'blue',
  bonded: 'violet',
}

/** Split a leading pictographic glyph (the option's own icon) from the text. */
function splitGlyph(text: string): { glyph: string | null; label: string } {
  const first = [...text][0] ?? ''
  if (first && /\p{Extended_Pictographic}/u.test(first)) {
    return { glyph: first, label: text.slice(first.length).trim() }
  }
  return { glyph: null, label: text }
}

function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <span aria-hidden className="mr-2 inline-block w-6 text-center font-body text-base leading-none">
      {children}
    </span>
  )
}

export function TownHub({
  decisionPoint,
  isResolving,
  character,
  onSelectOption,
  npcDispositions,
}: TownHubProps) {
  const featureOptions = decisionPoint.options.filter(
    o => o.id !== 'leave-town' && !o.id.startsWith('talk-to-npc-')
  )
  const npcOptions = decisionPoint.options.filter(o => o.id.startsWith('talk-to-npc-'))
  const leaveOption = decisionPoint.options.find(o => o.id === 'leave-town')

  return (
    <div>
      {decisionPoint.prompt && (
        <p className="break-words font-body text-base leading-relaxed text-ps-ink">{decisionPoint.prompt}</p>
      )}
      {isResolving && (
        <div className="mt-2 flex justify-center">
          <PrintingDots label="The scene plays out" />
        </div>
      )}

      <div className="mt-4 grid gap-2">
        {featureOptions.map(option => {
          const config = FEATURE_CONFIGS[option.id]
          const { glyph: textGlyph, label } = splitGlyph(option.text)
          const disabled =
            isResolving ||
            (config?.isDisabled ? config.isDisabled(option, character) : false)
          const disabledReason = config?.disabledReason
            ? config.disabledReason(option, character)
            : null

          return (
            <PlaybillLine
              key={option.id}
              onClick={() => !disabled && onSelectOption(option.id)}
              disabled={disabled}
              note={disabledReason ?? undefined}
            >
              <Glyph>{textGlyph ?? <DoorGlyph id={option.id} size={16} />}</Glyph>
              {label}
            </PlaybillLine>
          )
        })}
      </div>

      {npcOptions.length > 0 && (
        <>
          <PlaybillRule />
          <PlaybillCaption className="mb-2">Townspeople</PlaybillCaption>
          <div className="grid gap-2">
            {npcOptions.map(option => {
              const npcId = option.id.replace('talk-to-npc-', '')
              const disposition = npcDispositions?.[npcId] ?? 0
              const tier = getRelationshipTier(disposition)
              const { glyph, label } = splitGlyph(option.text)

              return (
                <PlaybillLine
                  key={option.id}
                  onClick={() => !isResolving && onSelectOption(option.id)}
                  disabled={isResolving}
                  trailing={
                    disposition !== 0 ? (
                      <Stamp tone={TIER_TONE[tier.tier] ?? 'ink'} tilt={false}>
                        {tier.label}
                      </Stamp>
                    ) : undefined
                  }
                >
                  {glyph && <Glyph>{glyph}</Glyph>}
                  {label}
                </PlaybillLine>
              )
            })}
          </div>
        </>
      )}

      {leaveOption && (
        <>
          <PlaybillRule />
          <PlaybillLine
            tone="quiet"
            onClick={() => !isResolving && onSelectOption(leaveOption.id)}
            disabled={isResolving}
          >
            {leaveOption.text}
          </PlaybillLine>
        </>
      )}
    </div>
  )
}
