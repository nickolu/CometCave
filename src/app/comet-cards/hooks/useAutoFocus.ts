'use client'

import { useEffect, useRef } from 'react'

/**
 * Focuses the first matching interactive element inside the container when the
 * component mounts. A small delay allows any entry animations to settle first.
 *
 * @param selector - CSS selector for the element to focus (default: first enabled button)
 */
export function useAutoFocus(selector = 'button:not([disabled])') {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      const el = containerRef.current?.querySelector<HTMLElement>(selector)
      el?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [selector])

  return containerRef
}
