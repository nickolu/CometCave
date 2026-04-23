'use client'
import { useState, useCallback } from 'react'

import { GameNPC, IntentType } from '@/app/tap-tap-adventure/config/npcs'

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ConversationEntry {
  role: 'player' | 'npc'
  content: string
  intent?: IntentType
  dispositionDelta?: number
}

interface DialogueState {
  dialogue: string
  intent?: string
  dispositionDelta?: number
  conversationComplete?: boolean
  reward?: { gold?: number; reputation?: number }
  revealLandmark?: boolean
}

interface UseNPCDialogueReturn {
  currentDialogue: DialogueState | null
  isLoading: boolean
  error: string | null
  conversationHistory: ConversationMessage[]
  conversationLog: ConversationEntry[]
  exchangeCount: number
  conversationComplete: boolean
  fetchDialogue: (params: {
    npc: GameNPC
    characterName: string
    characterClass: string
    characterLevel: number
    reputation: number
    region: string
    message?: string
    disposition?: number
    hiddenLandmarkName?: string
    hiddenLandmarkType?: string
  }) => Promise<DialogueState | null>
  reset: () => void
}

const MAX_LOG_ENTRIES = 20

export function useNPCDialogue(): UseNPCDialogueReturn {
  const [currentDialogue, setCurrentDialogue] = useState<DialogueState | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([])
  const [conversationLog, setConversationLog] = useState<ConversationEntry[]>([])
  const [exchangeCount, setExchangeCount] = useState(1)
  const [conversationComplete, setConversationComplete] = useState(false)

  const fetchDialogue = useCallback(async (params: {
    npc: GameNPC
    characterName: string
    characterClass: string
    characterLevel: number
    reputation: number
    region: string
    message?: string
    disposition?: number
    hiddenLandmarkName?: string
    hiddenLandmarkType?: string
  }): Promise<DialogueState | null> => {
    const { npc, characterName, characterClass, characterLevel, reputation, region, message, disposition = 0, hiddenLandmarkName, hiddenLandmarkType } = params
    setIsLoading(true)
    setError(null)

    // Keep only last 3 exchanges (6 messages) for context
    const recentHistory = conversationHistory.slice(-6)

    try {
      const res = await fetch('/api/v1/tap-tap-adventure/npc/dialogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          npcId: npc.id,
          characterName,
          characterClass,
          characterLevel,
          reputation,
          region,
          message,
          conversationHistory: recentHistory,
          disposition,
          exchangeCount,
          hiddenLandmarkName,
          hiddenLandmarkType,
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to fetch NPC dialogue')
      }

      const data = await res.json() as {
        dialogue: string
        intent?: string
        dispositionDelta?: number
        conversationComplete?: boolean
        reward?: { gold?: number; reputation?: number }
        revealLandmark?: boolean
      }

      const result: DialogueState = {
        dialogue: data.dialogue,
        intent: data.intent,
        dispositionDelta: data.dispositionDelta,
        conversationComplete: data.conversationComplete,
        reward: data.reward,
        revealLandmark: data.revealLandmark,
      }

      setCurrentDialogue(result)

      // Append to conversation history (for LLM context)
      const newHistory: ConversationMessage[] = [...conversationHistory]
      if (message) {
        newHistory.push({ role: 'user', content: message })
      }
      newHistory.push({ role: 'assistant', content: data.dialogue })
      setConversationHistory(newHistory)

      // Append to conversation log (for UI display), capped at MAX_LOG_ENTRIES
      setConversationLog(prev => {
        const updated = [...prev]
        if (message) {
          updated.push({
            role: 'player',
            content: message,
            intent: data.intent as IntentType | undefined,
          })
        }
        updated.push({
          role: 'npc',
          content: data.dialogue,
          dispositionDelta: data.dispositionDelta,
        })
        return updated.slice(-MAX_LOG_ENTRIES)
      })

      setExchangeCount(prev => prev + 1)

      if (data.conversationComplete) {
        setConversationComplete(true)
      }

      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
      const fallback: DialogueState = { dialogue: npc.greeting }
      setCurrentDialogue(fallback)
      setConversationLog(prev => {
        const updated = [...prev, { role: 'npc' as const, content: npc.greeting }]
        return updated.slice(-MAX_LOG_ENTRIES)
      })
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

  return {
    currentDialogue,
    isLoading,
    error,
    conversationHistory,
    conversationLog,
    exchangeCount,
    conversationComplete,
    fetchDialogue,
    reset,
  }
}
