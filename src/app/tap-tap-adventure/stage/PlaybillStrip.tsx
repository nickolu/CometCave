'use client'

/**
 * The playbill on the apron: the newest line of the story, and when the road
 * asks a question, the choices printed under it. Results print on the same
 * bill. Nothing here is a modal; the stage stays visible behind it.
 */
import * as React from 'react'

import { REGIONS } from '@/app/tap-tap-adventure/config/regions'
import type { RegionDifficulty } from '@/app/tap-tap-adventure/config/regions'
import { discoveryTier } from '@/app/tap-tap-adventure/lib/discovery'
import { euclidean } from '@/app/tap-tap-adventure/lib/movementUtils'
import type { FantasyCharacter, FantasyDecisionPoint } from '@/app/tap-tap-adventure/models/types'

import { ResourceGlyph } from './glyphs'
import { PaperButton, PlaybillCaption, PlaybillLine, PlaybillRule, PlaybillSheet, PlaybillTitle, PrintingDots, Stamp, deltaTone } from './Playbill'

/** Split a scene into its printed headline (the first sentence) and the rest. */
export function headlineOf(text: string): { head: string; rest: string } {
  const t = text.trim()
  const m = t.match(/^(.{12,140}?[.!?…])(\s+|$)/)
  if (!m) return t.length <= 90 ? { head: t, rest: '' } : { head: '', rest: t }
  return { head: m[1].trim(), rest: t.slice(m[0].length).trim() }
}

function Scene({ text, tone = 'ink' }: { text: string; tone?: 'ink' | 'soft' }) {
  const { head, rest } = headlineOf(text)
  return (
    <>
      {head && <PlaybillTitle size="md" rules={false} className="normal-case tracking-wide">{head}</PlaybillTitle>}
      {rest && <p className={`mt-2 break-words font-body text-base leading-relaxed ${tone === 'soft' ? 'text-ps-ink-soft' : 'text-ps-ink'}`}>{rest}</p>}
    </>
  )
}

export interface EventResult {
  outcomeDescription: string
  resourceDelta?: { gold?: number; reputation?: number }
  rewardItems?: { name: string; description?: string }[]
  mountDamage?: number
  mountDied?: boolean
}

const DIFFICULTY_LABEL: Record<RegionDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  very_hard: 'Very hard',
  extreme: 'Extreme',
}

/** "Heading to Pebble Ford · 14 km" for the caption, from the character's landmark state. */
export function describeTarget(character: FantasyCharacter | null): { label: string; km: number; hasShop: boolean; explored: boolean } | null {
  const ls = character?.landmarkState
  if (!ls) return null
  const idx = ls.activeTargetIndex ?? 0
  const isExit = idx >= ls.landmarks.length
  if (isExit) {
    const exits = ls.exitPositions ?? []
    const exit = exits[idx - ls.landmarks.length]
    const km = ls.position && exit?.position ? Math.ceil(euclidean(ls.position, exit.position)) : Math.max(0, (ls.regionLength ?? 200) - (ls.positionInRegion ?? 0))
    return { label: exit?.name ?? 'the region edge', km, hasShop: false, explored: false }
  }
  const lm = ls.landmarks[idx]
  if (!lm) return null
  const km = ls.position && lm.position ? Math.ceil(euclidean(ls.position, lm.position)) : Math.max(0, (lm.distanceFromEntry ?? 0) - (ls.positionInRegion ?? 0))
  const tier = discoveryTier(km, { explored: lm.explored, hidden: lm.hidden, mapped: lm.mapped })
  const label = tier === 'revealed' ? lm.name : tier === 'unknown' ? 'an unknown landmark' : 'a distant landmark'
  return { label, km, hasShop: tier === 'revealed' && (lm.hasShop ?? false), explored: lm.explored ?? false }
}

export interface PlaybillStripProps {
  caption: React.ReactNode
  target: ReturnType<typeof describeTarget>
  onChangeTarget?: () => void
  /** The newest line of the story when nothing is being asked. */
  newest: { text: string; title?: string } | null
  decisionPoint: FantasyDecisionPoint | null
  isLandmarkArrival: boolean
  arrivalLandmark: { name: string; icon: string; description: string; hasShop: boolean } | null
  isLegendary: boolean
  isResolving: boolean
  decisionGracePeriod: boolean
  onSelectOption: (optionId: string) => void
  /** Plain words when the last request failed. */
  errorLine?: string | null
  eventResult: EventResult | null
  onDismissResult: () => void
  npcPanel: React.ReactNode | null
  /** Anything else that belongs on the bill right now (a landmark panel, the stable, the mailbox…). */
  children?: React.ReactNode
}

export function PlaybillStrip({
  caption,
  target,
  onChangeTarget,
  newest,
  decisionPoint,
  isLandmarkArrival,
  arrivalLandmark,
  isLegendary,
  isResolving,
  decisionGracePeriod,
  onSelectOption,
  errorLine,
  eventResult,
  onDismissResult,
  npcPanel,
  children,
}: PlaybillStripProps) {
  const asking = !!decisionPoint && !decisionPoint.resolved
  const showResult = !!eventResult && !isResolving
  const printKey = showResult ? `r-${eventResult?.outcomeDescription.slice(0, 24)}` : asking ? `d-${decisionPoint?.id}` : `n-${newest?.text.slice(0, 32) ?? 'none'}`

  return (
    <PlaybillSheet
      as="section"
      aria-live="polite"
      aria-label="The playbill"
      className={isLegendary && asking ? 'outline outline-4 outline-offset-2 outline-ps-brass' : undefined}
    >
      <div className="px-4 pb-4 pt-3 sm:px-5">
        <div key={printKey} className="ps-print-in">
          {showResult ? (
            <>
              <PlaybillTitle size="sm">What came of it</PlaybillTitle>
              <p className="mt-3 break-words font-body text-base leading-relaxed text-ps-ink">{eventResult!.outcomeDescription}</p>
              {(eventResult!.resourceDelta || eventResult!.rewardItems?.length || eventResult!.mountDied || eventResult!.mountDamage) && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {eventResult!.resourceDelta?.gold != null && eventResult!.resourceDelta.gold !== 0 && (
                    <Stamp tone={deltaTone(eventResult!.resourceDelta.gold)} animate>
                      {eventResult!.resourceDelta.gold > 0 ? '+' : ''}{eventResult!.resourceDelta.gold} gold
                    </Stamp>
                  )}
                  {eventResult!.resourceDelta?.reputation != null && eventResult!.resourceDelta.reputation !== 0 && (
                    <Stamp tone={deltaTone(eventResult!.resourceDelta.reputation)} animate>
                      {eventResult!.resourceDelta.reputation > 0 ? '+' : ''}{eventResult!.resourceDelta.reputation} repute
                    </Stamp>
                  )}
                  {eventResult!.rewardItems?.map((item, i) => (
                    <Stamp key={i} tone="violet" animate title={item.description}>
                      Found: {item.name}
                    </Stamp>
                  ))}
                  {eventResult!.mountDied && <Stamp tone="red" animate>Your mount has fallen</Stamp>}
                  {eventResult!.mountDamage != null && eventResult!.mountDamage > 0 && !eventResult!.mountDied && (
                    <Stamp tone="red" animate>Mount took {eventResult!.mountDamage}</Stamp>
                  )}
                </div>
              )}
              <PaperButton className="mt-4 w-full" onClick={onDismissResult} autoFocus>
                Carry on
              </PaperButton>
            </>
          ) : asking ? (
            <>
              {arrivalLandmark ? (
                <div className="text-center">
                  <PlaybillTitle size="md" className="mt-1">
                    <ResourceGlyph kind="place" size={18} className="mr-2" />
                    {arrivalLandmark.name}
                  </PlaybillTitle>
                  <p className="mt-2 font-body text-sm italic leading-snug text-ps-ink-soft">{arrivalLandmark.description}</p>
                  {arrivalLandmark.hasShop && <Stamp tone="gold" className="mt-2">Shop here</Stamp>}
                </div>
              ) : isLegendary ? (
                <div className="flex justify-center">
                  <Stamp tone="gold" animate>
                    <ResourceGlyph kind="legendary" size={12} /> A legendary encounter
                  </Stamp>
                </div>
              ) : null}

              {npcPanel ? (
                <div className="mt-3">{npcPanel}</div>
              ) : (
                <>
                  <div className={arrivalLandmark || isLegendary ? 'mt-3' : ''}>
                    <Scene text={decisionPoint!.prompt} />
                  </div>
                  {isResolving ? (
                    <div className="flex justify-center py-5">
                      <PrintingDots label="The scene plays out" />
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-2">
                      {(decisionPoint!.options ?? []).map((option, index) => {
                        if (!option) return null
                        const travelId = option.id.startsWith('travel-') ? option.id.replace('travel-', '') : null
                        const region = travelId ? REGIONS[travelId] : null
                        return (
                          <PlaybillLine
                            key={option.id}
                            index={index + 1}
                            disabled={isResolving || decisionGracePeriod}
                            onClick={() => onSelectOption(option.id)}
                            trailing={
                              region ? (
                                <>
                                  <Stamp tone={region.difficulty === 'easy' ? 'green' : region.difficulty === 'medium' ? 'gold' : 'red'} tilt={false}>
                                    {DIFFICULTY_LABEL[region.difficulty]}
                                  </Stamp>
                                  {region.minLevel > 0 && <Stamp tone="ink" tilt={false}>Lv {region.minLevel}+</Stamp>}
                                </>
                              ) : undefined
                            }
                            note={region && region.element !== 'none' ? `${region.element} country` : undefined}
                          >
                            {option.text}
                          </PlaybillLine>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </>
          ) : newest ? (
            <Scene text={newest.text} />
          ) : (
            <p className="mt-1 font-body text-base italic leading-relaxed text-ps-ink-soft">The road is quiet. Tap WALK to set out.</p>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t-2 border-dotted border-ps-ink/40 pt-2">
          <PlaybillCaption>{caption}</PlaybillCaption>
          {target && !asking && !showResult && (
            <PlaybillCaption className="flex items-center gap-2 text-ps-ink">
              <span>
                {target.explored ? 'Leaving' : 'Heading to'} {target.label}
                {!target.explored && target.km > 0 && <span className="text-ps-ink-soft"> · {target.km} km</span>}
                {target.hasShop && <Stamp tone="gold" tilt={false} className="ml-2">Shop</Stamp>}
              </span>
              {onChangeTarget && (
                <button
                  type="button"
                  onClick={onChangeTarget}
                  className="rounded-[2px] border border-ps-ink px-1.5 py-0.5 text-xs tracking-widest hover:bg-ps-ink hover:text-ps-playbill focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ds-primary"
                >
                  Change
                </button>
              )}
            </PlaybillCaption>
          )}
        </div>

        {errorLine && (
          <p className="mt-3 flex items-center gap-2 font-body text-sm text-ps-stamp-red" role="alert">
            <Stamp tone="red" tilt={false}>Hold</Stamp>
            {errorLine}
          </p>
        )}

        {children && (
          <>
            <PlaybillRule />
            {children}
          </>
        )}
      </div>
    </PlaybillSheet>
  )
}
