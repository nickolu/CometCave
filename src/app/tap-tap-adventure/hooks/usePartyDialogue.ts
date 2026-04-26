'use client'
import { useState, useCallback } from 'react'

import type { IntentType } from '@/app/tap-tap-adventure/config/npcs'

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface PartyConversationEntry {
  role: 'player' | 'member'
  content: string
  intent?: IntentType
  dispositionDelta?: number
}

interface PartyDialogueState {
  dialogue: string
  intent?: string
  dispositionDelta?: number
  conversationComplete?: boolean
}

const MAX_LOG_ENTRIES = 20

export function usePartyDialogue() {
  const [currentDialogue, setCurrentDialogue] = useState<PartyDialogueState | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([])
  const [conversationLog, setConversationLog] = useState<PartyConversationEntry[]>([])
  const [exchangeCount, setExchangeCount] = useState(1)
  const [conversationComplete, setConversationComplete] = useState(false)

  const fetchDialogue = useCallback(async (params: {
    memberName: string
    memberClassName: string
    memberPersonality?: string
    characterName: string
    characterClass: string
    characterLevel: number
    characterCharisma?: number
    message?: string
    disposition?: number
  }): Promise<PartyDialogueState | null> => {
    setIsLoading(true)
    setError(null)

    const recentHistory = conversationHistory.slice(-6)

    try {
      const res = await fetch('/api/v1/tap-tap-adventure/party/dialogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...params,
          conversationHistory: recentHistory,
          exchangeCount,
        }),
      })

      if (!res.ok) throw new Error('Failed to fetch party dialogue')

      const data = await res.json() as PartyDialogueState

      setCurrentDialogue(data)

      const newHistory = [...conversationHistory]
      if (params.message) newHistory.push({ role: 'user', content: params.message })
      newHistory.push({ role: 'assistant', content: data.dialogue ?? '' })
      setConversationHistory(newHistory)

      setConversationLog(prev => {
        const updated = [...prev]
        if (params.message) {
          updated.push({ role: 'player', content: params.message, intent: data.intent as IntentType | undefined })
        }
        updated.push({ role: 'member', content: data.dialogue ?? '', dispositionDelta: data.dispositionDelta })
        return updated.slice(-MAX_LOG_ENTRIES)
      })

      setExchangeCount(prev => prev + 1)
      if (data.conversationComplete) setConversationComplete(true)

      return data
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
      const fallback: PartyDialogueState = { dialogue: `*nods quietly*` }
      setCurrentDialogue(fallback)
      setConversationLog(prev => [...prev, { role: 'member' as const, content: fallback.dialogue }].slice(-MAX_LOG_ENTRIES))
      return fallback
    } finally {
      setIsLoading(false)
    }
  }, [conversationHistory, exchangeCount])

  const reset = useCallback(() => {
    setCurrentDialogue(null)
    setError(null)
    setConversationHistory([])
    setConversationLog([])
    setExchangeCount(1)
    setConversationComplete(false)
  }, [])

  return { currentDialogue, isLoading, error, conversationLog, exchangeCount, conversationComplete, fetchDialogue, reset }
}
