import { useCallback, useRef, useState } from 'react'

import { useSafetyCheck } from '../api/hooks'
import { useStore } from '../store'

const USER_TYPING_TIMEOUT_MS = 1000

export function useChatInput({
  onMessageSent,
  scrollToBottom,
  handleGetCharacterResponses,
}: {
  onMessageSent: (message: string) => void
  scrollToBottom: () => void
  handleGetCharacterResponses: (message: string) => Promise<void>
}) {
  const [input, setInput] = useState('')
  const [isUserTyping, setIsUserTyping] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const userTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const sendMessage = useStore(state => state.sendMessage)
  const safetyCheck = useSafetyCheck()

  const handleUserTyping = useCallback(() => {
    setIsUserTyping(true)
    if (userTypingTimeoutRef.current) {
      clearTimeout(userTypingTimeoutRef.current)
    }
    userTypingTimeoutRef.current = setTimeout(() => {
      setIsUserTyping(false)
    }, USER_TYPING_TIMEOUT_MS)
  }, [])

  const handleSend = useCallback(async () => {
    const messageText = input.trim()
    if (messageText === '') return
    setIsUserTyping(false)
    if (userTypingTimeoutRef.current) {
      clearTimeout(userTypingTimeoutRef.current)
      userTypingTimeoutRef.current = null
    }
    setIsSubmitting(true)
    try {
      const result = await safetyCheck.mutateAsync(messageText)
      if (result.safe || result.isSafe) {
        sendMessage(messageText)
        setInput('')
        scrollToBottom()
        await handleGetCharacterResponses(messageText)
        onMessageSent(messageText)
      } else {
        setError(result.reason)
        const inputEl = document.getElementById('chat-input')
        inputEl?.classList.add('shake')
        setTimeout(() => inputEl?.classList.remove('shake'), 500)
      }
    } catch {
      setError('Failed to check message safety')
    } finally {
      setIsSubmitting(false)
    }
  }, [input, safetyCheck, sendMessage, scrollToBottom, handleGetCharacterResponses, onMessageSent])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInput(e.target.value)
    if (e.target.value.trim().length > 0) {
      handleUserTyping()
    } else {
      setIsUserTyping(false)
      if (userTypingTimeoutRef.current) {
        clearTimeout(userTypingTimeoutRef.current)
        userTypingTimeoutRef.current = null
      }
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return {
    input,
    setInput,
    isUserTyping,
    isSubmitting,
    error,
    setError,
    handleInputChange,
    handleKeyPress,
    handleSend,
    handleUserTyping,
  }
}
