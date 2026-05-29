'use client'

import { useCallback, useRef } from 'react'

/**
 * Provides arrow-key navigation across a flat list or 2D grid of card buttons.
 * Attach `containerRef` to the wrapper div and `handleKeyDown` to its onKeyDown.
 *
 * @param selector - CSS selector for focusable buttons inside the container
 */
export function useGridKeyboardNav(selector = 'button.bc-card') {
  const containerRef = useRef<HTMLDivElement>(null)
  const focusedIndexRef = useRef(0)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
      const container = containerRef.current
      if (!container) return
      const buttons = Array.from(container.querySelectorAll<HTMLElement>(selector))
      const currentIndex = buttons.indexOf(e.target as HTMLElement)
      if (currentIndex === -1) return
      e.preventDefault()

      let nextIndex = currentIndex

      if (e.key === 'ArrowRight') {
        nextIndex = Math.min(currentIndex + 1, buttons.length - 1)
      } else if (e.key === 'ArrowLeft') {
        nextIndex = Math.max(currentIndex - 1, 0)
      } else {
        // Estimate columns by counting buttons that share the same top position as current
        const currentTop = buttons[currentIndex].getBoundingClientRect().top
        let cols = 0
        for (const btn of buttons) {
          if (Math.abs(btn.getBoundingClientRect().top - currentTop) < 5) cols++
          else if (cols > 0) break
        }
        if (cols === 0) cols = buttons.length
        if (e.key === 'ArrowDown') {
          nextIndex = Math.min(currentIndex + cols, buttons.length - 1)
        } else {
          nextIndex = Math.max(currentIndex - cols, 0)
        }
      }

      focusedIndexRef.current = nextIndex
      buttons[nextIndex]?.focus()
    },
    [selector]
  )

  return { containerRef, handleKeyDown, focusedIndexRef }
}
