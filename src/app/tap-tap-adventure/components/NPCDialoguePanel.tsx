'use client'

/**
 * Talking to someone: their lines print onto the bill as paragraphs under
 * their name; what you said sits to the right in a quieter hand. The
 * cut-out of the speaker is already on the scenery above.
 */
import { useEffect, useRef, useState } from 'react'

import { GameNPC, getRelationshipTier } from '@/app/tap-tap-adventure/config/npcs'
import { useNPCDialogue } from '@/app/tap-tap-adventure/hooks/useNPCDialogue'
import { PaperButton, PlaybillCaption, PrintingDots, Stamp, type StampTone, deltaTone } from '@/app/tap-tap-adventure/stage/Playbill'
import { cn } from '@/lib/utils'

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
  onRecruit?: () => void
  isRecruited?: boolean
}

const TIER_TONE: Record<string, StampTone> = {
  hostile: 'red',
  unfriendly: 'gold',
  neutral: 'ink',
  friendly: 'green',
  trusted: 'blue',
  bonded: 'violet',
}

const TIER_BAR: Record<string, string> = {
  hostile: 'bg-ps-stamp-red',
  unfriendly: 'bg-ps-stamp-gold',
  neutral: 'bg-ps-ink',
  friendly: 'bg-ps-stamp-green',
  trusted: 'bg-ps-stamp-blue',
  bonded: 'bg-ps-stamp-violet',
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
  onRecruit,
  isRecruited = false,
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
  const tierPct = Math.max(5, Math.min(100, ((disposition - tier.min) / (tier.max - tier.min)) * 100))

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
    <div>
      {/* Who, and how they feel about you */}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h3 className="font-playbill text-base uppercase leading-tight tracking-wide text-ps-ink">{npc.name}</h3>
          <PlaybillCaption>{npc.role}</PlaybillCaption>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <Stamp tone={TIER_TONE[tier.tier] ?? 'ink'} tilt={false}>{tier.label}</Stamp>
            <span className="font-body text-xs tabular-nums text-ps-ink-soft">({disposition > 0 ? '+' : ''}{disposition})</span>
          </div>
          <span
            className="block h-1.5 w-24 overflow-hidden rounded-full bg-ps-ink/20"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(tierPct)}
            aria-label={`Standing with ${npc.name}: ${tier.label}`}
          >
            <span className={cn('block h-full rounded-full transition-[width] duration-500', TIER_BAR[tier.tier] ?? 'bg-ps-ink')} style={{ width: `${tierPct}%` }} />
          </span>
        </div>
      </div>

      {exchangeCount > 1 && (
        <PlaybillCaption className="mt-2 text-right text-ps-ink-faint">Exchange {exchangeCount - 1}</PlaybillCaption>
      )}

      {/* What has been said */}
      <div className="ps-scroll mt-3 max-h-60 space-y-3 overflow-y-auto border-y-2 border-dotted border-ps-ink/40 py-3 pr-1">
        {conversationLog.length === 0 && !isLoading && (
          <p className="font-body text-sm italic text-ps-ink-soft">Approach {npc.name} to speak...</p>
        )}
        {conversationLog.map((entry, idx) => (
          <div key={idx} className={cn('ps-print-in', entry.role === 'player' && 'pl-8 text-right')}>
            {entry.role === 'npc' ? (
              <>
                <PlaybillCaption>{npc.name}</PlaybillCaption>
                <p className="mt-0.5 break-words font-body text-base leading-relaxed text-ps-ink">&ldquo;{entry.content}&rdquo;</p>
              </>
            ) : (
              <>
                <PlaybillCaption className="text-ps-ink-faint">You</PlaybillCaption>
                <p className="mt-0.5 break-words font-body text-sm italic leading-relaxed text-ps-ink-soft">{entry.content}</p>
              </>
            )}
            {entry.role === 'player' && entry.intent && entry.intent !== 'neutral' && (
              <span className="mt-0.5 inline-block font-label text-xs font-bold uppercase tracking-widest text-ps-ink-faint">{entry.intent}</span>
            )}
            {entry.role === 'npc' && entry.dispositionDelta !== undefined && entry.dispositionDelta !== 0 && (
              <Stamp tone={deltaTone(entry.dispositionDelta)} className="mt-1.5">
                {entry.dispositionDelta > 0 ? '+' : ''}{entry.dispositionDelta} standing
              </Stamp>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="py-1">
            <PrintingDots label={`${npc.name} is speaking`} />
          </div>
        )}
        <div ref={logEndRef} />
      </div>

      {rewardMessage && (
        <p role="status" className="mt-3 flex flex-wrap items-center gap-2 font-body text-sm text-ps-ink">
          <Stamp tone="gold" animate>Gift</Stamp>
          <span>{npc.name} granted you: {rewardMessage}</span>
        </p>
      )}

      {/* Your reply */}
      {!conversationComplete && (
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            className="h-10 min-w-0 flex-1 rounded-[3px] border-2 border-ps-ink bg-transparent px-3 font-body text-sm text-ps-ink placeholder:text-ps-ink-faint focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary disabled:opacity-50"
            placeholder="Type your response..."
            aria-label="Type your response"
            value={playerInput}
            onChange={e => setPlayerInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading || conversationComplete}
          />
          <PaperButton
            onClick={() => void handleSend()}
            disabled={isLoading || !playerInput.trim() || conversationComplete}
          >
            Send
          </PaperButton>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        {npc.combatRole === 'combatant' && !isRecruited && disposition >= 20 && onRecruit && (
          <PaperButton className="flex-1" onClick={onRecruit}>
            Join my party
          </PaperButton>
        )}
        <PaperButton variant="outline" className="flex-1" onClick={onClose}>
          {conversationComplete ? 'Farewell' : 'Walk away'}
        </PaperButton>
      </div>
    </div>
  )
}
