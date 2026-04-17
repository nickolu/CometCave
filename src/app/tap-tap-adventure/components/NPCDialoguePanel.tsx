'use client'

import { useEffect, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/app/tap-tap-adventure/components/ui/button'
import { GameNPC } from '@/app/tap-tap-adventure/config/npcs'
import { useNPCDialogue } from '@/app/tap-tap-adventure/hooks/useNPCDialogue'

interface NPCDialoguePanelProps {
  npc: GameNPC
  characterName: string
  characterClass: string
  characterLevel: number
  reputation: number
  region: string
  timesSpoken: number
  onReward?: (reward: { gold?: number; reputation?: number }) => void
  onClose: () => void
}

function getDispositionLabel(timesSpoken: number): { label: string; color: string } {
  if (timesSpoken === 0) return { label: 'Stranger', color: 'text-slate-400' }
  if (timesSpoken < 3) return { label: 'Acquaintance', color: 'text-blue-400' }
  if (timesSpoken < 7) return { label: 'Friendly', color: 'text-green-400' }
  return { label: 'Trusted Friend', color: 'text-amber-400' }
}

export function NPCDialoguePanel({
  npc,
  characterName,
  characterClass,
  characterLevel,
  reputation,
  region,
  timesSpoken,
  onReward,
  onClose,
}: NPCDialoguePanelProps) {
  const { currentDialogue, isLoading, fetchDialogue } = useNPCDialogue()
  const [rewardMessage, setRewardMessage] = useState<string | null>(null)
  const [hasOpened, setHasOpened] = useState(false)

  const disposition = getDispositionLabel(timesSpoken)

  const startDialogue = async () => {
    const result = await fetchDialogue({
      npc,
      characterName,
      characterClass,
      characterLevel,
      reputation,
      region,
    })
    // Always record the encounter (increments timesSpoken, applies optional reward)
    if (onReward) {
      onReward(result?.reward ?? {})
    }
    if (result?.reward) {
      const parts: string[] = []
      if (result.reward.gold) parts.push(`+${result.reward.gold} gold`)
      if (result.reward.reputation) parts.push(`+${result.reward.reputation} reputation`)
      if (parts.length > 0) setRewardMessage(parts.join(', '))
    }
  }

  // Auto-fetch dialogue on first open
  useEffect(() => {
    if (!hasOpened) {
      setHasOpened(true)
      startDialogue()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleTalkAgain = async () => {
    setRewardMessage(null)
    const result = await fetchDialogue({
      npc,
      characterName,
      characterClass,
      characterLevel,
      reputation,
      region,
    })
    // Record the encounter each time the player talks
    if (onReward) {
      onReward(result?.reward ?? {})
    }
    if (result?.reward) {
      const parts: string[] = []
      if (result.reward.gold) parts.push(`+${result.reward.gold} gold`)
      if (result.reward.reputation) parts.push(`+${result.reward.reputation} reputation`)
      if (parts.length > 0) setRewardMessage(parts.join(', '))
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
          <span className={`text-[10px] font-semibold uppercase tracking-wide ${disposition.color}`}>
            {disposition.label}
          </span>
          <button
            className="text-slate-400 hover:text-white text-xs px-2 py-1 border border-[#3a3c56] rounded hover:border-slate-500 transition-colors"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>

      {/* Dialogue area */}
      <div className="min-h-[80px] bg-[#161723] border border-[#2a2b3f] rounded p-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <LoaderCircle className="animate-spin h-4 w-4" />
            <span>{npc.name} is speaking...</span>
          </div>
        ) : currentDialogue ? (
          <p className="text-sm text-slate-200 leading-relaxed italic">
            &ldquo;{currentDialogue.dialogue}&rdquo;
          </p>
        ) : (
          <p className="text-sm text-slate-500 italic">Approach {npc.name} to speak...</p>
        )}
      </div>

      {/* Reward notification */}
      {rewardMessage && (
        <div className="text-xs text-amber-300 bg-amber-900/20 border border-amber-700/30 rounded px-2 py-1.5">
          {npc.name} granted you: {rewardMessage}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          className="flex-1 text-sm border border-[#3a3c56] bg-[#2a2b3f] hover:bg-[#3a3c56] text-white py-2 rounded disabled:opacity-60"
          onClick={handleTalkAgain}
          disabled={isLoading}
        >
          Talk Again
        </Button>
      </div>
    </div>
  )
}
