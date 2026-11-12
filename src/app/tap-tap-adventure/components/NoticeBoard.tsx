'use client'

/**
 * The notice board: a quest pinned to the bill, the landmarks of this
 * country, and what is being said about the region.
 */
import { useEffect, useState } from 'react'

import { REGIONS, getRegion } from '@/app/tap-tap-adventure/config/regions'
import { calculateDay } from '@/app/tap-tap-adventure/lib/leveling'
import { generateTimedQuest } from '@/app/tap-tap-adventure/lib/questGenerator'
import { TimedQuest } from '@/app/tap-tap-adventure/models/quest'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/types'
import { CloseIcon } from '@/app/tap-tap-adventure/stage/icons'
import { PaperButton, PlaybillCaption, PlaybillTitle, PrintingDots, Stamp, type StampTone } from '@/app/tap-tap-adventure/stage/Playbill'
import { aiFetch } from '@/lib/api/ai-fetch'

interface NoticeBoardProps {
  character: FantasyCharacter
  activeQuest: TimedQuest | null
  onAcceptQuest: (quest: TimedQuest) => void
  onClose: () => void
}

function getQuestProgress(quest: TimedQuest, character: FantasyCharacter): { current: number; total: number } {
  const range = quest.target - quest.startValue
  switch (quest.type) {
    case 'reach_distance':
      return { current: Math.max(0, character.distance - quest.startValue), total: range }
    case 'collect_gold':
      return { current: Math.max(0, character.gold - quest.startValue), total: range }
    case 'gain_reputation':
      return { current: Math.max(0, character.reputation - quest.startValue), total: range }
    case 'win_combat':
      return { current: quest.status === 'completed' ? 1 : 0, total: 1 }
    default:
      return { current: 0, total: 1 }
  }
}

function generateRumors(character: FantasyCharacter): string[] {
  const region = getRegion(character.currentRegion ?? 'green_meadows')
  const rumors: string[] = []

  // Rumor about connected regions
  const connectedIds = region.connectedRegions.filter(id => id !== (character.currentRegion ?? 'green_meadows'))
  if (connectedIds.length > 0) {
    const connectedRegion = REGIONS[connectedIds[0]]
    if (connectedRegion) {
      rumors.push(`Travelers speak of ${connectedRegion.icon} ${connectedRegion.name} — said to be ${connectedRegion.description.split('.')[0].toLowerCase()}.`)
    }
    if (connectedIds.length > 1) {
      const second = REGIONS[connectedIds[1]]
      if (second) {
        rumors.push(`Merchants warn that ${second.name} grows more dangerous by the day. Only seasoned adventurers dare venture there.`)
      }
    }
  }

  // Rumor about unexplored landmarks
  const unexplored = (character.landmarkState?.landmarks ?? []).filter(lm => !lm.explored && !lm.hidden)
  if (unexplored.length > 0) {
    const lm = unexplored[0]
    rumors.push(`Locals whisper of ${lm.icon} ${lm.name} nearby — few have ventured inside and returned to tell the tale.`)
  }

  // Rumor about hidden landmarks
  const hidden = (character.landmarkState?.landmarks ?? []).filter(lm => lm.hidden)
  if (hidden.length > 0) {
    rumors.push(`An old wanderer mutters something about a secret place hidden in this region, but refuses to say more.`)
  }

  // Fallback regional flavor
  if (rumors.length < 2) {
    rumors.push(`The ${region.theme.split(',')[0]} here is said to hold ancient secrets for those patient enough to seek them.`)
  }

  return rumors.slice(0, 3)
}

export function NoticeBoard({ character, activeQuest, onAcceptQuest, onClose }: NoticeBoardProps) {
  const [generatedQuest, setGeneratedQuest] = useState<TimedQuest | null>(null)
  const [isLoading, setIsLoading] = useState(!activeQuest)

  useEffect(() => {
    if (activeQuest) return

    setIsLoading(true)
    aiFetch('/api/v1/tap-tap-adventure/quest/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ character }),
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: TimedQuest) => {
        setGeneratedQuest(data)
        setIsLoading(false)
      })
      .catch(() => {
        setGeneratedQuest(generateTimedQuest(character))
        setIsLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const currentDay = calculateDay(character.distance ?? 0)
  const rumors = generateRumors(character)
  const landmarks = character.landmarkState?.landmarks ?? []

  const daysTone = (quest: TimedQuest): StampTone => {
    const remaining = quest.deadlineDay - currentDay
    if (remaining <= 0) return 'red'
    if (remaining <= 2) return 'gold'
    return 'green'
  }

  return (
    <section aria-label="Notice board">
      <div className="flex items-start gap-2">
        <PlaybillTitle size="sm" className="min-w-0 flex-1">Notice board</PlaybillTitle>
        <PaperButton variant="outline" size="sm" className="w-8 shrink-0 px-0" onClick={onClose} aria-label="Close notice board">
          <CloseIcon />
        </PaperButton>
      </div>

      {/* Quests & Bounties */}
      <PlaybillCaption className="mt-4 mb-2">Quests and bounties</PlaybillCaption>
      {activeQuest ? (
        <div className="rounded-[3px] border-2 border-ps-ink p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="font-body text-base font-semibold leading-snug text-ps-ink">{activeQuest.title}</h3>
            <Stamp tone={daysTone(activeQuest)} tilt={false}>
              {activeQuest.deadlineDay - currentDay <= 0
                ? 'Expired'
                : `${activeQuest.deadlineDay - currentDay} day(s) left`}
            </Stamp>
          </div>
          <p className="mt-1 font-body text-sm leading-snug text-ps-ink-soft">{activeQuest.description}</p>
          {(() => {
            const { current, total } = getQuestProgress(activeQuest, character)
            const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0
            return (
              <div className="mt-2 flex items-center gap-2">
                <span
                  className="block h-1.5 flex-1 overflow-hidden rounded-full bg-ps-ink/20"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                  aria-label="Quest progress"
                >
                  <span className="block h-full rounded-full bg-ps-ink" style={{ width: `${pct}%` }} />
                </span>
                <span className="w-16 text-right font-body text-xs tabular-nums text-ps-ink-soft">{current} / {total}</span>
              </div>
            )
          })()}
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-3">
          <PrintingDots label="The board considers your request" />
        </div>
      ) : generatedQuest ? (
        <div className="rounded-[3px] border-2 border-ps-ink p-3">
          <Stamp tone="violet">New quest</Stamp>
          <h3 className="mt-2 font-body text-base font-semibold leading-snug text-ps-ink">{generatedQuest.title}</h3>
          <p className="mt-1 font-body text-sm leading-snug text-ps-ink-soft">{generatedQuest.description}</p>
          <p className="mt-2 font-body text-sm text-ps-ink">
            Reward: <span className="font-playbill tabular-nums">{generatedQuest.rewards.gold} g</span>
            {generatedQuest.rewards.reputation ? ` · ${generatedQuest.rewards.reputation} rep` : ''}
            {generatedQuest.rewards.items?.length ? ` · ${generatedQuest.rewards.items[0].name}` : ''}
          </p>
          <PaperButton size="sm" className="mt-3" onClick={() => onAcceptQuest(generatedQuest)}>
            Accept quest
          </PaperButton>
        </div>
      ) : (
        <p className="font-body text-sm italic text-ps-ink-soft">No quests posted right now.</p>
      )}

      {/* Area Landmarks */}
      <PlaybillCaption className="mt-5 mb-2">Landmarks in this country</PlaybillCaption>
      {landmarks.length === 0 ? (
        <p className="font-body text-sm italic text-ps-ink-soft">No landmarks found in this area yet.</p>
      ) : (
        <ul className="divide-y-2 divide-dotted divide-ps-ink/40">
          {landmarks.map((lm, i) => {
            if (lm.hidden) {
              return (
                <li key={i} className="flex items-center gap-3 py-1.5 font-body text-sm italic text-ps-ink-faint">
                  <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-current font-playbill text-xs leading-none">?</span>
                  <span className="flex-1">A rumored place, not yet found</span>
                </li>
              )
            }
            return (
              <li key={i} className={`flex items-center gap-3 py-1.5 font-body text-sm ${lm.explored ? 'text-ps-ink-soft' : 'text-ps-ink'}`}>
                <span aria-hidden className="w-6 shrink-0 text-center text-base leading-none">{lm.icon}</span>
                <span className="min-w-0 flex-1 truncate">{lm.name}</span>
                {lm.explored ? (
                  <Stamp tone="green" tilt={false}>Explored</Stamp>
                ) : (
                  <Stamp tone="gold" tilt={false}>Unexplored</Stamp>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Regional Rumors */}
      <PlaybillCaption className="mt-5 mb-2">Regional rumors</PlaybillCaption>
      <ul className="space-y-2">
        {rumors.map((rumor, i) => (
          <li key={i} className="flex gap-2 font-body text-sm italic leading-relaxed text-ps-ink">
            <span aria-hidden className="shrink-0 text-ps-ink-soft">—</span>
            <span>{rumor}</span>
          </li>
        ))}
      </ul>

      <PaperButton variant="outline" className="mt-5 w-full border-ps-ink/50 text-ps-ink-soft" onClick={onClose}>
        Back to town
      </PaperButton>
    </section>
  )
}
