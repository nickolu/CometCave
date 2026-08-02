import { type RefObject, useEffect } from 'react'

/**
 * Manages focus for modal dialogs:
 * - On mount: moves focus to the first focusable element inside the dialog
 *   (or the container itself if nothing else is focusable)
 * - On unmount: returns focus to whatever element was focused before the dialog opened
 */
export function useDialogFocus<T extends HTMLElement | null>(containerRef: RefObject<T>) {
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const container = containerRef.current as HTMLElement | null

    const focusable = container?.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), ' +
        'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    const target = focusable ?? container
    target?.focus()

    return () => {
      previousFocus?.focus()
    }
  }, [containerRef])
}
