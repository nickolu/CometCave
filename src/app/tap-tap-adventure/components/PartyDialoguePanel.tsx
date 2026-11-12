'use client'

/**
 * A word with someone in your party, printed on the party drawer's bill:
 * their lines as paragraphs under their name, yours to the right.
 */
import { useEffect, useRef, useState } from 'react'

import { getRelationshipTier } from '@/app/tap-tap-adventure/config/npcs'
import { usePartyDialogue } from '@/app/tap-tap-adventure/hooks/usePartyDialogue'
import type { PartyMember } from '@/app/tap-tap-adventure/models/partyMember'
import { CloseIcon } from '@/app/tap-tap-adventure/stage/icons'
import { PaperButton, PlaybillCaption, PrintingDots, Stamp, type StampTone, deltaTone } from '@/app/tap-tap-adventure/stage/Playbill'
import { cn } from '@/lib/utils'

interface PartyDialoguePanelProps {
  member: PartyMember
  characterName: string
  characterClass: string
  characterLevel: number
  characterCharisma: number
  disposition: number
  onDispositionChange: (delta: number) => void
  onClose: () => void
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

export function PartyDialoguePanel({
  member,
  characterName,
  characterClass,
  characterLevel,
  characterCharisma,
  disposition,
  onDispositionChange,
  onClose,
}: PartyDialoguePanelProps) {
  const { conversationLog, isLoading, conversationComplete, fetchDialogue, reset } = usePartyDialogue()
  const [inputText, setInputText] = useState('')
  const logRef = useRef<HTMLDivElement>(null)
  const [currentDisposition, setCurrentDisposition] = useState(disposition)

  // Fetch greeting on mount
  useEffect(() => {
    fetchDialogue({
      memberName: member.customName ?? member.name,
      memberClassName: member.className,
      memberPersonality: member.personality,
      characterName,
      characterClass,
      characterLevel,
      characterCharisma,
      disposition: currentDisposition,
    })
    return () => reset()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [conversationLog])

  const handleSend = async () => {
    if (!inputText.trim() || isLoading || conversationComplete) return
    const msg = inputText.trim()
    setInputText('')
    const result = await fetchDialogue({
      memberName: member.customName ?? member.name,
      memberClassName: member.className,
      memberPersonality: member.personality,
      characterName,
      characterClass,
      characterLevel,
      characterCharisma,
      message: msg,
      disposition: currentDisposition,
    })
    if (result?.dispositionDelta) {
      setCurrentDisposition(prev => Math.max(-100, Math.min(100, prev + result.dispositionDelta!)))
      onDispositionChange(result.dispositionDelta)
    }
  }

  const tier = getRelationshipTier(currentDisposition)
  const name = member.customName ?? member.name
  const barPct = Math.max(0, Math.min(100, (currentDisposition + 100) / 2))

  return (
    <div className="flex max-h-[400px] flex-col rounded-[3px] border-2 border-ps-ink p-3">
      {/* Who */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-body text-xl leading-none" aria-hidden>{member.icon}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-playbill text-base uppercase leading-tight tracking-wide text-ps-ink">{name}</span>
              <Stamp tone={TIER_TONE[tier.tier] ?? 'ink'} tilt={false}>{tier.label}</Stamp>
            </div>
            <PlaybillCaption>{member.className}</PlaybillCaption>
          </div>
        </div>
        <PaperButton variant="outline" size="sm" className="w-8 shrink-0 px-0" onClick={onClose} aria-label="Close dialogue">
          <CloseIcon />
        </PaperButton>
      </div>

      {/* Standing */}
      <span
        className="mt-2 block h-1.5 overflow-hidden rounded-full bg-ps-ink/20"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(barPct)}
        aria-label={`Standing with ${name}: ${tier.label}`}
      >
        <span className={cn('block h-full rounded-full transition-[width]', TIER_BAR[tier.tier] ?? 'bg-ps-ink')} style={{ width: `${barPct}%` }} />
      </span>

      {/* What has been said */}
      <div ref={logRef} className="ps-scroll mt-3 max-h-[200px] min-h-[120px] flex-1 space-y-3 overflow-y-auto border-y-2 border-dotted border-ps-ink/40 py-2 pr-1">
        {conversationLog.map((entry, i) => (
          <div key={i} className={cn('ps-print-in', entry.role === 'player' && 'pl-8 text-right')}>
            {entry.role === 'player' ? (
              <>
                <PlaybillCaption className="text-ps-ink-faint">You</PlaybillCaption>
                <p className="mt-0.5 break-words font-body text-sm italic leading-relaxed text-ps-ink-soft">{entry.content}</p>
              </>
            ) : (
              <>
                <PlaybillCaption>{name}</PlaybillCaption>
                <p className="mt-0.5 break-words font-body text-sm leading-relaxed text-ps-ink">
                  {entry.content}
                  {entry.dispositionDelta !== undefined && entry.dispositionDelta !== 0 && (
                    <Stamp tone={deltaTone(entry.dispositionDelta)} tilt={false} className="ml-2 align-middle">
                      {entry.dispositionDelta > 0 ? '+' : ''}{entry.dispositionDelta}
                    </Stamp>
                  )}
                </p>
              </>
            )}
          </div>
        ))}
        {isLoading && <PrintingDots label="Thinking" />}
      </div>

      {/* Your reply */}
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          className="h-8 min-w-0 flex-1 rounded-[3px] border-2 border-ps-ink bg-transparent px-2 font-body text-sm text-ps-ink placeholder:text-ps-ink-faint focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary disabled:opacity-50"
          placeholder={conversationComplete ? 'Conversation ended' : 'Say something...'}
          aria-label="Dialogue input"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          disabled={isLoading || conversationComplete}
        />
        <PaperButton size="sm" onClick={handleSend} disabled={isLoading || conversationComplete || !inputText.trim()}>
          Send
        </PaperButton>
      </div>

      <PaperButton variant="outline" size="sm" className="mt-2 w-full border-ps-ink/50 text-ps-ink-soft" onClick={onClose}>
        {conversationComplete ? 'Close' : 'End conversation'}
      </PaperButton>
    </div>
  )
}
