'use client'
import { useState } from 'react'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { calculateDay } from '@/app/tap-tap-adventure/lib/leveling'
import { getNPCById } from '@/app/tap-tap-adventure/config/npcs'
import { getRegion } from '@/app/tap-tap-adventure/config/regions'

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

  return (
    <div className="bg-[#1e1f30] border border-[#3a3c56] rounded-lg p-3 space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-sm font-bold text-amber-400">
          📬 Mailbox {unreadCount > 0 && <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded-full ml-1">{unreadCount}</span>}
        </span>
        <button className="text-slate-400 hover:text-white text-sm" onClick={onClose}>✕</button>
      </div>

      {composing ? (
        <div className="space-y-3">
          <button className="text-[10px] text-slate-400 hover:text-slate-200" onClick={() => { setComposing(false); setSelectedNpcId(null); setMessageText(''); setSendResult(null) }}>← Back to inbox</button>

          <h4 className="text-xs font-semibold text-slate-300">Write a Letter</h4>

          {/* NPC contact selection */}
          <div>
            <div className="text-[10px] text-slate-400 mb-1">To:</div>
            <div className="space-y-1 max-h-[120px] overflow-y-auto">
              {Object.entries(character.npcEncounters ?? {})
                .filter(([, enc]) => (enc.disposition ?? 0) >= 0)
                .map(([npcId]) => {
                  const npc = getNPCById(npcId)
                  if (!npc) return null
                  return (
                    <button
                      key={npcId}
                      className={`w-full text-left text-[10px] px-2 py-1.5 rounded border transition-colors ${
                        selectedNpcId === npcId
                          ? 'border-indigo-500 bg-indigo-900/30 text-indigo-200'
                          : 'border-[#3a3c56] bg-[#252638] text-slate-300 hover:border-slate-500'
                      }`}
                      onClick={() => setSelectedNpcId(npcId)}
                    >
                      {npc.icon} {npc.name} — {npc.role}
                    </button>
                  )
                })}
            </div>
          </div>

          {/* Message input */}
          {selectedNpcId && (
            <>
              <div>
                <div className="text-[10px] text-slate-400 mb-1">Message:</div>
                <textarea
                  className="w-full text-[11px] bg-[#252638] border border-[#3a3c56] rounded p-2 text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-indigo-500"
                  rows={3}
                  maxLength={200}
                  placeholder="Write your message..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                />
                <div className="text-[10px] text-slate-600 text-right">{messageText.length}/200</div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[10px] text-amber-400">
                  Cost: {sendCost} gold
                </span>
                <button
                  className={`text-[10px] px-3 py-1.5 rounded font-semibold transition-colors ${
                    messageText.trim().length > 0
                      ? 'bg-indigo-900/50 text-indigo-300 hover:bg-indigo-800/60'
                      : 'bg-slate-700/40 text-slate-500 cursor-not-allowed'
                  }`}
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
                  Send Letter
                </button>
              </div>

              {sendResult && (
                <div className={`text-[10px] p-2 rounded ${sendResult.includes('sent') ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                  {sendResult}
                </div>
              )}
            </>
          )}
        </div>
      ) : selectedMail ? (
        // Reading a message
        <div className="space-y-2">
          <button className="text-[10px] text-slate-400 hover:text-slate-200" onClick={() => setSelectedMailId(null)}>← Back to inbox</button>
          <div className="bg-[#252638] border border-[#3a3c56] rounded p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{selectedMail.fromIcon}</span>
              <div>
                <div className="text-xs font-semibold text-slate-200">{selectedMail.fromName}</div>
                <div className="text-[10px] text-slate-500">Day {selectedMail.day}</div>
              </div>
            </div>
            <div className="text-xs font-semibold text-slate-300">{selectedMail.subject}</div>
            <div className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">{selectedMail.body}</div>
            {selectedMail.attachedGold && selectedMail.attachedGold > 0 && (
              <div className="mt-2">
                <button
                  className="text-[10px] px-2 py-1 bg-amber-900/40 text-amber-400 rounded hover:bg-amber-800/50 transition-colors"
                  onClick={() => {
                    claimMailGold(selectedMail.id)
                    setSelectedMailId(null)
                  }}
                >
                  💰 Claim {selectedMail.attachedGold} gold
                </button>
              </div>
            )}
            {selectedMail.attachedItems && selectedMail.attachedItems.length > 0 && !selectedMail.itemsClaimed && (
              <div className="mt-2">
                <button
                  className="text-[10px] px-2 py-1 bg-purple-900/40 text-purple-400 rounded hover:bg-purple-800/50 transition-colors"
                  onClick={() => {
                    claimMailItems(selectedMail.id)
                    setSelectedMailId(null)
                  }}
                >
                  🎁 Claim {selectedMail.attachedItems!.length} item(s)
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        // Inbox list
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-500">Inbox</span>
            <button
              className="text-[10px] px-2 py-1 bg-indigo-900/40 text-indigo-300 rounded hover:bg-indigo-800/50"
              onClick={() => setComposing(true)}
            >
              ✉️ Write Letter
            </button>
          </div>

          {(character.pendingReplies ?? []).length > 0 && (
            <div className="text-[10px] text-indigo-400 italic bg-indigo-900/20 border border-indigo-700/30 rounded p-2">
              ✉️ {character.pendingReplies!.length} letter(s) sent — replies expected in a few days
            </div>
          )}

          <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
            {mail.length === 0 ? (
              <div className="text-xs text-slate-500 italic py-4 text-center">No mail yet. Befriend NPCs and they may write to you!</div>
            ) : (
              mail.sort((a, b) => b.day - a.day).map(m => (
                <button
                  key={m.id}
                  className={`w-full text-left bg-[#252638] border rounded p-2 flex items-center gap-2 transition-colors ${
                    m.read ? 'border-[#3a3c56] hover:border-slate-500' : 'border-indigo-700/50 hover:border-indigo-500'
                  }`}
                  onClick={() => {
                    if (!m.read) markMailRead(m.id)
                    setSelectedMailId(m.id)
                  }}
                >
                  <span className="text-lg">{m.fromIcon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className={`text-xs font-semibold ${m.read ? 'text-slate-400' : 'text-slate-200'}`}>{m.fromName}</span>
                      {!m.read && <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />}
                      {m.attachedGold && m.attachedGold > 0 && <span className="text-[10px] text-amber-400">💰</span>}
                      {m.attachedItems && m.attachedItems.length > 0 && !m.itemsClaimed && <span className="text-[10px] text-purple-400">🎁</span>}
                    </div>
                    <div className={`text-[10px] truncate ${m.read ? 'text-slate-500' : 'text-slate-300'}`}>{m.subject}</div>
                  </div>
                  <span className="text-[10px] text-slate-600 shrink-0">Day {m.day}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      <button className="w-full text-xs text-slate-400 hover:text-slate-200 py-1 transition-colors" onClick={onClose}>
        ← Back to Town
      </button>
    </div>
  )
}
