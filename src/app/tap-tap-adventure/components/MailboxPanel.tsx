'use client'

/**
 * The mailbox: letters as ruled rows that open into the full letter, unread
 * ones stamped in red; writing a letter costs a few gold.
 */
import { useState } from 'react'

import { getNPCById } from '@/app/tap-tap-adventure/config/npcs'
import { getRegion } from '@/app/tap-tap-adventure/config/regions'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { calculateDay } from '@/app/tap-tap-adventure/lib/leveling'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { CloseIcon } from '@/app/tap-tap-adventure/stage/icons'
import { PaperButton, PlaybillCaption, PlaybillLine, PlaybillSheet, PlaybillTitle, Stamp } from '@/app/tap-tap-adventure/stage/Playbill'
import { cn } from '@/lib/utils'

interface MailboxPanelProps {
  character: FantasyCharacter
  onClose: () => void
}

export function MailboxPanel({ character, onClose }: MailboxPanelProps) {
  const { markMailRead, claimMailGold, claimMailItems, sendMail } = useGameStore()
  const [selectedMailId, setSelectedMailId] = useState<string | null>(null)
  const [composing, setComposing] = useState(false)
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null)
  const [messageText, setMessageText] = useState('')
  const [sendResult, setSendResult] = useState<string | null>(null)

  const currentDay = calculateDay(character.distance ?? 0)
  const mail = (character.mailbox ?? []).filter(m => m.day <= currentDay)
  const unreadCount = mail.filter(m => !m.read).length
  const selectedMail = mail.find(m => m.id === selectedMailId)

  const sendCost = Math.max(5, Math.round(5 * getRegion(character.currentRegion ?? 'green_meadows').difficultyMultiplier))

  const backToInbox = (label = 'Back to inbox', onClick: () => void) => (
    <PaperButton variant="outline" size="sm" className="border-ps-ink/50 text-ps-ink-soft" onClick={onClick}>
      {label}
    </PaperButton>
  )

  return (
    <section aria-label="Mailbox">
      <div className="flex items-start gap-2">
        <PlaybillTitle size="sm" className="min-w-0 flex-1">
          Mailbox
          {unreadCount > 0 && <Stamp tone="red" className="ml-2 align-middle">{unreadCount} unread</Stamp>}
        </PlaybillTitle>
        <PaperButton variant="outline" size="sm" className="w-8 shrink-0 px-0" onClick={onClose} aria-label="Close mailbox">
          <CloseIcon />
        </PaperButton>
      </div>

      {composing ? (
        <div className="mt-3 space-y-3">
          {backToInbox('Back to inbox', () => { setComposing(false); setSelectedNpcId(null); setMessageText(''); setSendResult(null) })}

          <PlaybillCaption>Write a letter</PlaybillCaption>

          {/* NPC contact selection */}
          <div>
            <PlaybillCaption className="mb-1 text-ps-ink-faint">To</PlaybillCaption>
            <div className="ps-scroll grid max-h-[160px] gap-1.5 overflow-y-auto pr-1">
              {Object.entries(character.npcEncounters ?? {})
                .filter(([, enc]) => (enc.disposition ?? 0) >= 0)
                .map(([npcId]) => {
                  const npc = getNPCById(npcId)
                  if (!npc) return null
                  const selected = selectedNpcId === npcId
                  return (
                    <PlaybillLine
                      key={npcId}
                      aria-pressed={selected}
                      className={cn('py-1.5 text-sm', selected && 'bg-ps-ink text-ps-playbill')}
                      note={npc.role}
                      onClick={() => setSelectedNpcId(npcId)}
                    >
                      <span aria-hidden className="mr-2">{npc.icon}</span>
                      {npc.name}
                    </PlaybillLine>
                  )
                })}
            </div>
          </div>

          {/* Message input */}
          {selectedNpcId && (
            <>
              <label className="block">
                <PlaybillCaption className="mb-1 text-ps-ink-faint">Message</PlaybillCaption>
                <textarea
                  className="w-full resize-none rounded-[3px] border-2 border-ps-ink bg-transparent p-2 font-body text-sm text-ps-ink placeholder:text-ps-ink-faint focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
                  rows={3}
                  maxLength={200}
                  placeholder="Write your message..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  aria-label="Message"
                />
                <span className="block text-right font-label text-xs font-bold uppercase tracking-widest tabular-nums text-ps-ink-soft">{messageText.length}/200</span>
              </label>

              <div className="flex items-center justify-between gap-3">
                <span className="font-body text-sm text-ps-ink">
                  Postage <span className="font-playbill tabular-nums">{sendCost} g</span>
                </span>
                <PaperButton
                  variant="brass"
                  size="sm"
                  disabled={messageText.trim().length === 0}
                  onClick={() => {
                    const success = sendMail(selectedNpcId!, messageText.trim())
                    if (success) {
                      setSendResult(`Letter sent to ${getNPCById(selectedNpcId!)?.name ?? 'NPC'}! Expect a reply in a few days.`)
                      setMessageText('')
                      setSelectedNpcId(null)
                    } else {
                      setSendResult('Not enough gold to send this letter.')
                    }
                  }}
                >
                  Send letter
                </PaperButton>
              </div>
            </>
          )}

          {sendResult && (
            <p
              role="status"
              className={cn(
                'rounded-[2px] border-2 border-dotted px-3 py-2 font-body text-sm',
                sendResult.includes('sent') ? 'border-ps-stamp-green text-ps-stamp-green' : 'border-ps-stamp-red text-ps-stamp-red'
              )}
            >
              {sendResult}
            </p>
          )}
        </div>
      ) : selectedMail ? (
        // Reading a letter
        <div className="mt-3 space-y-3">
          {backToInbox('Back to inbox', () => setSelectedMailId(null))}
          <PlaybillSheet flat as="article" className="p-4">
            <div className="flex items-center justify-between gap-2">
              <PlaybillCaption className="text-ps-ink">
                <span aria-hidden className="mr-1.5 normal-case">{selectedMail.fromIcon}</span>
                From {selectedMail.fromName}
              </PlaybillCaption>
              <PlaybillCaption className="shrink-0 tabular-nums">Day {selectedMail.day}</PlaybillCaption>
            </div>
            <h3 className="mt-2 font-playbill text-base leading-tight text-ps-ink">{selectedMail.subject}</h3>
            <p className="mt-2 whitespace-pre-wrap font-body text-sm leading-relaxed text-ps-ink">{selectedMail.body}</p>
            {((selectedMail.attachedGold && selectedMail.attachedGold > 0) ||
              (selectedMail.attachedItems && selectedMail.attachedItems.length > 0 && !selectedMail.itemsClaimed)) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedMail.attachedGold && selectedMail.attachedGold > 0 ? (
                  <PaperButton
                    variant="brass"
                    size="sm"
                    onClick={() => {
                      claimMailGold(selectedMail.id)
                      setSelectedMailId(null)
                    }}
                  >
                    Claim <span className="tabular-nums">{selectedMail.attachedGold} g</span>
                  </PaperButton>
                ) : null}
                {selectedMail.attachedItems && selectedMail.attachedItems.length > 0 && !selectedMail.itemsClaimed && (
                  <PaperButton
                    size="sm"
                    onClick={() => {
                      claimMailItems(selectedMail.id)
                      setSelectedMailId(null)
                    }}
                  >
                    Claim {selectedMail.attachedItems!.length} item(s)
                  </PaperButton>
                )}
              </div>
            )}
          </PlaybillSheet>
        </div>
      ) : (
        // Inbox list
        <div className="mt-3">
          <div className="flex items-center justify-between gap-2">
            <PlaybillCaption>Inbox</PlaybillCaption>
            <PaperButton variant="outline" size="sm" onClick={() => setComposing(true)}>
              Write a letter
            </PaperButton>
          </div>

          {(character.pendingReplies ?? []).length > 0 && (
            <p className="mt-2 font-body text-xs italic text-ps-ink-soft">
              {character.pendingReplies!.length} letter(s) sent — replies expected in a few days
            </p>
          )}

          <div className="ps-scroll mt-2 max-h-[280px] overflow-y-auto pr-1">
            {mail.length === 0 ? (
              <p className="py-4 text-center font-body text-sm italic text-ps-ink-soft">No mail yet. Befriend NPCs and they may write to you!</p>
            ) : (
              <ul className="divide-y-2 divide-dotted divide-ps-ink/40" aria-label="Letters">
                {mail.sort((a, b) => b.day - a.day).map(m => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-1 py-2.5 text-left transition-colors hover:bg-ps-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
                      onClick={() => {
                        if (!m.read) markMailRead(m.id)
                        setSelectedMailId(m.id)
                      }}
                    >
                      <span aria-hidden className="w-6 shrink-0 text-center font-body text-base leading-none">{m.fromIcon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className={cn('font-body text-sm font-semibold', m.read ? 'text-ps-ink-soft' : 'text-ps-ink')}>{m.fromName}</span>
                          {!m.read && <Stamp tone="red" tilt={false}>New</Stamp>}
                          {m.attachedGold && m.attachedGold > 0 ? <Stamp tone="gold" tilt={false}>Gold</Stamp> : null}
                          {m.attachedItems && m.attachedItems.length > 0 && !m.itemsClaimed && <Stamp tone="violet" tilt={false}>Gift</Stamp>}
                        </span>
                        <span className={cn('block truncate font-body text-xs', m.read ? 'text-ps-ink-faint' : 'text-ps-ink-soft')}>{m.subject}</span>
                      </span>
                      <span className="shrink-0 font-label text-xs font-bold uppercase tracking-widest tabular-nums text-ps-ink-faint">Day {m.day}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <PaperButton variant="outline" className="mt-4 w-full border-ps-ink/50 text-ps-ink-soft" onClick={onClose}>
        Back to town
      </PaperButton>
    </section>
  )
}
