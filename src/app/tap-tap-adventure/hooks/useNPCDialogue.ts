'use client'
import { useState, useCallback } from 'react'

import { GameNPC } from '@/app/tap-tap-adventure/config/npcs'

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

interface DialogueState {
  dialogue: string
  reward?: { gold?: number; reputation?: number }
}

interface UseNPCDialogueReturn {
  currentDialogue: DialogueState | null
  isLoading: boolean
  error: string | null
  conversationHistory: ConversationMessage[]
  fetchDialogue: (params: {
    npc: GameNPC
    characterName: string
    characterClass: string
    characterLevel: number
    reputation: number
    region: string
    message?: string
  }) => Promise<DialogueState | null>
  reset: () => void
}

export function useNPCDialogue(): UseNPCDialogueReturn {
  const [currentDialogue, setCurrentDialogue] = useState<DialogueState | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([])

  const fetchDialogue = useCallback(async (params: {
    npc: GameNPC
    characterName: string
    characterClass: string
    characterLevel: number
    reputation: number
    region: string
    message?: string
  }): Promise<DialogueState | null> => {
    const { npc, characterName, characterClass, characterLevel, reputation, region, message } = params
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
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to fetch NPC dialogue')
      }

      const data = await res.json() as { dialogue: string; reward?: { gold?: number; reputation?: number } }
      const result: DialogueState = { dialogue: data.dialogue, reward: data.reward }

      setCurrentDialogue(result)

      // Append to conversation history
      const newHistory: ConversationMessage[] = [...conversationHistory]
      if (message) {
        newHistory.push({ role: 'user', content: message })
      }
      newHistory.push({ role: 'assistant', content: data.dialogue })
      setConversationHistory(newHistory)

      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
      const fallback: DialogueState = { dialogue: npc.greeting }
      setCurrentDialogue(fallback)
      return fallback
    } finally {
      setIsLoading(false)
    }
  }, [conversationHistory])

  const reset = useCallback(() => {
    setCurrentDialogue(null)
    setError(null)
    setConversationHistory([])
  }, [])

  return { currentDialogue, isLoading, error, conversationHistory, fetchDialogue, reset }
}
