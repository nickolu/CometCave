import { useState, useRef, useCallback } from 'react'

export function useChatScroll() {
  const [showScrollButton, setShowScrollButton] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messageContainerRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const handleScroll = useCallback(() => {
    if (!messageContainerRef.current) return
    const { scrollHeight, scrollTop, clientHeight } = messageContainerRef.current
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
    setShowScrollButton(!isNearBottom)
  }, [])

  return {
    showScrollButton,
    setShowScrollButton,
    messagesEndRef,
    messageContainerRef,
    scrollToBottom,
    handleScroll,
  }
}
