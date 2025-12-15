import { useState } from 'react'

import { useStore } from '../store'

export function useChatMenu({
  characterResponseTimerRef,
}: {
  characterResponseTimerRef: React.MutableRefObject<NodeJS.Timeout | null>
}) {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const resetChat = useStore(state => state.resetChat)

  const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setMenuAnchor(event.currentTarget)
  }

  const handleMenuClose = () => {
    setMenuAnchor(null)
  }

  const handleReset = () => {
    resetChat()
    handleMenuClose()
    if (characterResponseTimerRef.current) {
      clearInterval(characterResponseTimerRef.current)
      characterResponseTimerRef.current = null
    }
  }

  return {
    menuAnchor,
    handleMenuOpen,
    handleMenuClose,
    handleReset,
  }
}
