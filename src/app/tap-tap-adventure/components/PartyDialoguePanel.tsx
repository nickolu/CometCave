'use client'
import { useState, useEffect, useRef } from 'react'
import { getRelationshipTier } from '@/app/tap-tap-adventure/config/npcs'
import { usePartyDialogue } from '@/app/tap-tap-adventure/hooks/usePartyDialogue'
import type { PartyMember } from '@/app/tap-tap-adventure/models/partyMember'

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
  const tierColors: Record<string, string> = {
    hostile: 'text-red-400 bg-red-900/30',
    unfriendly: 'text-orange-400 bg-orange-900/30',
    neutral: 'text-slate-300 bg-slate-700/30',
    friendly: 'text-green-400 bg-green-900/30',
    trusted: 'text-blue-400 bg-blue-900/30',
    bonded: 'text-amber-400 bg-amber-900/30',
  }

  return (
    <div className="bg-[#1e1f30] border border-[#3a3c56] rounded-lg p-3 space-y-3 max-h-[400px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{member.icon}</span>
          <div>
            <div className="text-sm font-semibold text-slate-200">{member.customName ?? member.name}</div>
            <div className="text-[10px] text-slate-400">{member.className}</div>
          </div>
          <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${tierColors[tier.tier] ?? ''}`}>
            {tier.label}
          </span>
        </div>
        <button className="text-slate-400 hover:text-white text-sm" onClick={onClose}>&#x2715;</button>
      </div>

      {/* Disposition bar */}
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full transition-all"
          style={{ width: `${Math.max(0, Math.min(100, (currentDisposition + 100) / 2))}%` }}
        />
      </div>

      {/* Conversation log */}
      <div ref={logRef} className="flex-1 overflow-y-auto space-y-2 min-h-[120px] max-h-[200px]">
        {conversationLog.map((entry, i) => (
          <div key={i} className={`text-xs ${entry.role === 'player' ? 'text-right' : ''}`}>
            {entry.role === 'player' ? (
              <div className="inline-block bg-indigo-900/40 border border-indigo-700/30 rounded px-2 py-1 text-indigo-200">
                {entry.content}
              </div>
            ) : (
              <div className="text-slate-300">
                <span className="text-slate-500">{member.customName ?? member.name}:</span> {entry.content}
                {entry.dispositionDelta !== undefined && entry.dispositionDelta !== 0 && (
                  <span className={`ml-1 text-[10px] ${entry.dispositionDelta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ({entry.dispositionDelta > 0 ? '+' : ''}{entry.dispositionDelta})
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
        {isLoading && <div className="text-[10px] text-slate-500 italic">Thinking...</div>}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          className="flex-1 bg-[#252638] border border-[#3a3c56] rounded px-2 py-1 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          placeholder={conversationComplete ? 'Conversation ended' : 'Say something...'}
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          disabled={isLoading || conversationComplete}
        />
        <button
          className={`text-xs px-3 py-1 rounded transition-colors ${
            isLoading || conversationComplete || !inputText.trim()
              ? 'bg-slate-700/40 text-slate-500 cursor-not-allowed'
              : 'bg-indigo-700/50 text-indigo-300 hover:bg-indigo-600/60'
          }`}
          onClick={handleSend}
          disabled={isLoading || conversationComplete || !inputText.trim()}
        >
          Send
        </button>
      </div>

      {/* End conversation */}
      <button
        className="text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
        onClick={onClose}
      >
        {conversationComplete ? 'Close' : 'End conversation'}
      </button>
    </div>
  )
}
