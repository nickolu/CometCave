'use client'
import { useState, useEffect } from 'react'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/types'
import { TimedQuest } from '@/app/tap-tap-adventure/models/quest'
import { getRegion, REGIONS } from '@/app/tap-tap-adventure/config/regions'
import { calculateDay } from '@/app/tap-tap-adventure/lib/leveling'
import { generateTimedQuest } from '@/app/tap-tap-adventure/lib/questGenerator'

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

  useEffect(() => {
    if (!activeQuest) {
      setGeneratedQuest(generateTimedQuest(character))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const currentDay = calculateDay(character.distance ?? 0)
  const rumors = generateRumors(character)
  const landmarks = character.landmarkState?.landmarks ?? []

  const daysColor = (quest: TimedQuest) => {
    const remaining = quest.deadlineDay - currentDay
    if (remaining <= 0) return 'text-red-400'
    if (remaining <= 2) return 'text-yellow-400'
    return 'text-green-400'
  }

  return (
    <div className="bg-[#1e1f30] border border-[#3a3c56] rounded-lg p-3 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <span className="text-sm font-bold text-amber-400">📋 Notice Board</span>
        <button className="text-slate-400 hover:text-white text-sm" onClick={onClose}>✕</button>
      </div>

      {/* Section 1: Quests & Bounties */}
      <div>
        <h4 className="text-xs font-semibold text-slate-400 uppercase border-b border-[#3a3c56] pb-1 mb-2">
          Quests &amp; Bounties
        </h4>
        {activeQuest ? (
          <div className="bg-[#252638] border border-[#3a3c56] rounded p-2 space-y-1.5">
            <div className="text-xs font-semibold text-slate-200">{activeQuest.title}</div>
            <div className="text-[10px] text-slate-400 leading-relaxed">{activeQuest.description}</div>
            {(() => {
              const { current, total } = getQuestProgress(activeQuest, character)
              const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0
              return (
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-400 w-16 text-right">{current} / {total}</span>
                  </div>
                </div>
              )
            })()}
            <div className={`text-[10px] font-semibold ${daysColor(activeQuest)}`}>
              {activeQuest.deadlineDay - currentDay <= 0
                ? 'Quest expired!'
                : `${activeQuest.deadlineDay - currentDay} day(s) remaining`}
            </div>
          </div>
        ) : generatedQuest ? (
          <div className="bg-[#252638] border border-indigo-700/40 rounded p-2 space-y-1.5">
            <div className="text-[10px] text-indigo-400 font-semibold uppercase">New Quest Available</div>
            <div className="text-xs font-semibold text-slate-200">{generatedQuest.title}</div>
            <div className="text-[10px] text-slate-400 leading-relaxed">{generatedQuest.description}</div>
            <div className="text-[10px] text-amber-300">
              Reward: {generatedQuest.rewards.gold}g
              {generatedQuest.rewards.reputation ? ` · ${generatedQuest.rewards.reputation} rep` : ''}
              {generatedQuest.rewards.items?.length ? ` · ${generatedQuest.rewards.items[0].name}` : ''}
            </div>
            <button
              className="text-[10px] px-2 py-1 bg-indigo-900/50 text-indigo-300 rounded hover:bg-indigo-800/60 transition-colors"
              onClick={() => onAcceptQuest(generatedQuest)}
            >
              Accept Quest
            </button>
          </div>
        ) : (
          <div className="text-xs text-slate-500 italic">No quests available right now.</div>
        )}
      </div>

      {/* Section 2: Area Landmarks */}
      <div>
        <h4 className="text-xs font-semibold text-slate-400 uppercase border-b border-[#3a3c56] pb-1 mb-2">
          Area Landmarks
        </h4>
        {landmarks.length === 0 ? (
          <div className="text-xs text-slate-500 italic">No landmarks discovered in this area.</div>
        ) : (
          <div className="space-y-1">
            {landmarks.map((lm, i) => {
              if (lm.hidden) {
                return (
                  <div key={i} className="flex items-center gap-2 text-[10px] text-slate-600 italic">
                    <span>❓</span>
                    <span>??? — Rumored location</span>
                  </div>
                )
              }
              if (lm.explored) {
                return (
                  <div key={i} className="flex items-center gap-2 text-[10px] text-slate-500">
                    <span>{lm.icon}</span>
                    <span className="flex-1 truncate">{lm.name}</span>
                    <span className="text-green-600 text-[9px]">✓ Explored</span>
                  </div>
                )
              }
              return (
                <div key={i} className="flex items-center gap-2 text-[10px] text-slate-300">
                  <span>{lm.icon}</span>
                  <span className="flex-1 truncate">{lm.name}</span>
                  <span className="text-[9px] px-1 py-0.5 bg-amber-900/40 text-amber-400 rounded">Unexplored</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Section 3: Regional Rumors */}
      <div>
        <h4 className="text-xs font-semibold text-slate-400 uppercase border-b border-[#3a3c56] pb-1 mb-2">
          Regional Rumors
        </h4>
        <div className="space-y-2">
          {rumors.map((rumor, i) => (
            <div key={i} className="flex gap-1.5 text-[10px] text-slate-400 italic leading-relaxed">
              <span className="shrink-0">💬</span>
              <span>{rumor}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Back button */}
      <button
        className="w-full text-xs text-slate-400 hover:text-slate-200 py-1 transition-colors"
        onClick={onClose}
      >
        Back to Town
      </button>
    </div>
  )
}
