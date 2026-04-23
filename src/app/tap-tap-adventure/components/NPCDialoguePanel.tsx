'use client'

import { useEffect, useRef, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/app/tap-tap-adventure/components/ui/button'
import { GameNPC, getRelationshipTier } from '@/app/tap-tap-adventure/config/npcs'
import { useNPCDialogue } from '@/app/tap-tap-adventure/hooks/useNPCDialogue'

interface NPCDialoguePanelProps {
  npc: GameNPC
  characterName: string
  characterClass: string
  characterLevel: number
  reputation: number
  region: string
  characterCharisma: number
  activeCharismaBonus?: number
  disposition: number
  hiddenLandmarkName?: string
  hiddenLandmarkType?: string
  onEncounterUpdate: (dispositionDelta: number, reward?: { gold?: number; reputation?: number }, revealLandmark?: boolean) => void
  onClose: () => void
}

export function NPCDialoguePanel({
  npc,
  characterName,
  characterClass,
  characterLevel,
  reputation,
  region,
  characterCharisma,
  activeCharismaBonus = 0,
  disposition,
  hiddenLandmarkName,
  hiddenLandmarkType,
  onEncounterUpdate,
  onClose,
}: NPCDialoguePanelProps) {
  const effectiveCharisma = characterCharisma + activeCharismaBonus
  const {
    isLoading,
    conversationLog,
    exchangeCount,
    conversationComplete,
    fetchDialogue,
    reset,
  } = useNPCDialogue()

  const [playerInput, setPlayerInput] = useState('')
  const [rewardMessage, setRewardMessage] = useState<string | null>(null)
  const [hasOpened, setHasOpened] = useState(false)
  const logEndRef = useRef<HTMLDivElement>(null)

  const tier = getRelationshipTier(disposition)

  const tierBadgeColors: Record<string, string> = {
    hostile: 'text-red-500',
    unfriendly: 'text-orange-400',
    neutral: 'text-slate-400',
    friendly: 'text-green-400',
    trusted: 'text-blue-400',
    bonded: 'text-amber-400',
  }

  const badgeColor = tierBadgeColors[tier.tier] ?? 'text-slate-400'

  // Auto-scroll to bottom of conversation log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversationLog])

  // Fetch NPC greeting on first open
  useEffect(() => {
    if (!hasOpened) {
      setHasOpened(true)
      void fetchDialogue({
        npc,
        characterName,
        characterClass,
        characterLevel,
        reputation,
        region,
        disposition,
        hiddenLandmarkName,
        hiddenLandmarkType,
        characterCharisma: effectiveCharisma,
      }).then(result => {
        onEncounterUpdate(result?.dispositionDelta ?? 0, result?.reward, result?.revealLandmark)
        if (result?.reward) {
          const parts: string[] = []
          if (result.reward.gold) parts.push(`+${result.reward.gold} gold`)
          if (result.reward.reputation) parts.push(`+${result.reward.reputation} reputation`)
          if (parts.length > 0) setRewardMessage(parts.join(', '))
        }
      })
    }
    // Reset on unmount
    return () => { reset() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSend = async () => {
    const trimmed = playerInput.trim()
    if (!trimmed || isLoading || conversationComplete) return
    setPlayerInput('')
    setRewardMessage(null)

    const result = await fetchDialogue({
      npc,
      characterName,
      characterClass,
      characterLevel,
      reputation,
      region,
      message: trimmed,
      disposition,
      hiddenLandmarkName,
      hiddenLandmarkType,
      characterCharisma: effectiveCharisma,
    })

    onEncounterUpdate(result?.dispositionDelta ?? 0, result?.reward, result?.revealLandmark)

    if (result?.reward) {
      const parts: string[] = []
      if (result.reward.gold) parts.push(`+${result.reward.gold} gold`)
      if (result.reward.reputation) parts.push(`+${result.reward.reputation} reputation`)
      if (parts.length > 0) setRewardMessage(parts.join(', '))
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  return (
    <div className="bg-[#1e1f30] border border-[#3a3c56] rounded-lg p-4 space-y-3">
      {/* NPC Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden="true">{npc.icon}</span>
          <div>
            <div className="font-bold text-white text-sm">{npc.name}</div>
            <div className="text-xs text-slate-400">{npc.role}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-end gap-0.5">
            <span className={`text-[10px] font-semibold uppercase tracking-wide ${badgeColor}`}>
              {tier.label}
            </span>
            {/* Disposition progress bar */}
            <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  tier.tier === 'hostile' ? 'bg-red-500' :
                  tier.tier === 'unfriendly' ? 'bg-orange-400' :
                  tier.tier === 'neutral' ? 'bg-slate-400' :
                  tier.tier === 'friendly' ? 'bg-green-400' :
                  tier.tier === 'trusted' ? 'bg-blue-400' :
                  'bg-amber-400'
                }`}
                style={{ width: `${Math.max(5, Math.min(100, ((disposition - tier.min) / (tier.max - tier.min)) * 100))}%` }}
              />
            </div>
            <span className="text-[9px] text-slate-500">({disposition > 0 ? '+' : ''}{disposition})</span>
          </div>
          <button
            className="text-slate-400 hover:text-white text-xs px-2 py-1 border border-[#3a3c56] rounded hover:border-slate-500 transition-colors"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>

      {/* Exchange counter */}
      {exchangeCount > 1 && (
        <div className="text-[10px] text-slate-500 text-right">
          Exchange {exchangeCount - 1}
        </div>
      )}

      {/* Conversation log */}
      <div className="max-h-60 overflow-y-auto bg-[#161723] border border-[#2a2b3f] rounded p-3 space-y-2">
        {conversationLog.length === 0 && !isLoading && (
          <p className="text-sm text-slate-500 italic">Approach {npc.name} to speak...</p>
        )}
        {conversationLog.map((entry, idx) => (
          <div key={idx} className={`flex flex-col ${entry.role === 'player' ? 'items-end' : 'items-start'}`}>
            {entry.role === 'npc' ? (
              <p className="text-sm text-slate-200 leading-relaxed italic max-w-[90%]">
                <span className="not-italic mr-1">{npc.icon}</span>
                &ldquo;{entry.content}&rdquo;
              </p>
            ) : (
              <p className="text-sm text-slate-300 leading-relaxed max-w-[90%] bg-[#252640] rounded px-2 py-1">
                {entry.content}
              </p>
            )}
            {entry.role === 'player' && entry.intent && entry.intent !== 'neutral' && (
              <span className="text-[9px] text-slate-500 mt-0.5 capitalize">{entry.intent}</span>
            )}
            {entry.role === 'npc' && entry.dispositionDelta !== undefined && entry.dispositionDelta !== 0 && (
              <span className={`text-[9px] mt-0.5 ${entry.dispositionDelta > 0 ? 'text-green-500' : 'text-red-400'}`}>
                {entry.dispositionDelta > 0 ? '+' : ''}{entry.dispositionDelta} rep
              </span>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <LoaderCircle className="animate-spin h-4 w-4" />
            <span>{npc.name} is speaking...</span>
          </div>
        )}
        <div ref={logEndRef} />
      </div>

      {/* Reward notification */}
      {rewardMessage && (
        <div className="text-xs text-amber-300 bg-amber-900/20 border border-amber-700/30 rounded px-2 py-1.5">
          {npc.name} granted you: {rewardMessage}
        </div>
      )}

      {/* Text input */}
      {!conversationComplete && (
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 bg-[#161723] border border-[#2a2b3f] rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-600 disabled:opacity-50"
            placeholder="Type your response..."
            value={playerInput}
            onChange={e => setPlayerInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading || conversationComplete}
          />
          <Button
            className="text-sm border border-indigo-700 bg-indigo-800 hover:bg-indigo-700 text-white px-3 py-2 rounded disabled:opacity-60"
            onClick={() => void handleSend()}
            disabled={isLoading || !playerInput.trim() || conversationComplete}
          >
            Send
          </Button>
        </div>
      )}

      {/* Action row */}
      <div className="flex gap-2">
        <Button
          className="flex-1 text-sm border border-[#3a3c56] bg-[#2a2b3f] hover:bg-[#3a3c56] text-white py-2 rounded"
          onClick={onClose}
        >
          {conversationComplete ? 'Farewell' : 'Walk Away'}
        </Button>
      </div>
    </div>
  )
}
