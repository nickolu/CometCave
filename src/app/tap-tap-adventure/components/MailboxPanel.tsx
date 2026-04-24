'use client'
import { useState } from 'react'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { calculateDay } from '@/app/tap-tap-adventure/lib/leveling'

interface MailboxPanelProps {
  character: FantasyCharacter
  onClose: () => void
}

export function MailboxPanel({ character, onClose }: MailboxPanelProps) {
  const { markMailRead, claimMailGold } = useGameStore()
  const [selectedMailId, setSelectedMailId] = useState<string | null>(null)

  const currentDay = calculateDay(character.distance ?? 0)
  const mail = (character.mailbox ?? []).filter(m => m.day <= currentDay)
  const unreadCount = mail.filter(m => !m.read).length
  const selectedMail = mail.find(m => m.id === selectedMailId)

  return (
    <div className="bg-[#1e1f30] border border-[#3a3c56] rounded-lg p-3 space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-sm font-bold text-amber-400">
          📬 Mailbox {unreadCount > 0 && <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded-full ml-1">{unreadCount}</span>}
        </span>
        <button className="text-slate-400 hover:text-white text-sm" onClick={onClose}>✕</button>
      </div>

      {selectedMail ? (
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
          </div>
        </div>
      ) : (
        // Inbox list
        <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
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
                  </div>
                  <div className={`text-[10px] truncate ${m.read ? 'text-slate-500' : 'text-slate-300'}`}>{m.subject}</div>
                </div>
                <span className="text-[10px] text-slate-600 shrink-0">Day {m.day}</span>
              </button>
            ))
          )}
        </div>
      )}

      <button className="w-full text-xs text-slate-400 hover:text-slate-200 py-1 transition-colors" onClick={onClose}>
        ← Back to Town
      </button>
    </div>
  )
}
