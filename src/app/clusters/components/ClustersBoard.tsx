'use client'

import { useEffect, useRef, useState } from 'react'

import { GROUP_SIZE } from '@/app/clusters/models/clusters'
import { cn } from '@/lib/utils'

const COLUMNS = 4

/** Long words shrink the text, never the tile. */
function lengthClass(word: string): string {
  if (word.length <= 6) return 'cl-len-s'
  if (word.length <= 9) return 'cl-len-m'
  if (word.length <= 13) return 'cl-len-l'
  return 'cl-len-xl'
}

interface ClustersBoardProps {
  words: string[]
  selection: string[]
  onToggle: (word: string) => void
  disabled?: boolean
  /** Bumped on a wrong guess to shake the board. */
  shakeKey?: number
}

export function ClustersBoard({
  words,
  selection,
  onToggle,
  disabled = false,
  shakeKey = 0,
}: ClustersBoardProps) {
  const [focusIndex, setFocusIndex] = useState(0)
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const boardRef = useRef<HTMLDivElement | null>(null)

  // The board shrinks as groups are solved, so the roving index is clamped
  // on render rather than corrected through state.
  const rovingIndex = Math.min(focusIndex, Math.max(0, words.length - 1))

  // Driven through the DOM so a second wrong guess replays the animation
  // and no render is spent on a transient visual.
  useEffect(() => {
    if (!shakeKey) return
    const el = boardRef.current
    if (!el) return
    el.classList.remove('cl-shake')
    void el.offsetWidth
    el.classList.add('cl-shake')
    const t = setTimeout(() => el.classList.remove('cl-shake'), 420)
    return () => clearTimeout(t)
  }, [shakeKey])

  function move(to: number) {
    if (to < 0 || to >= words.length) return
    setFocusIndex(to)
    refs.current[to]?.focus()
  }

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault()
        move(index + 1)
        break
      case 'ArrowLeft':
        event.preventDefault()
        move(index - 1)
        break
      case 'ArrowDown':
        event.preventDefault()
        move(index + COLUMNS)
        break
      case 'ArrowUp':
        event.preventDefault()
        move(index - COLUMNS)
        break
      case 'Home':
        event.preventDefault()
        move(0)
        break
      case 'End':
        event.preventDefault()
        move(words.length - 1)
        break
      default:
        break
    }
  }

  const atCap = selection.length >= GROUP_SIZE

  return (
    <div ref={boardRef} role="group" aria-label="Word board" className="cl-board">
      {words.map((word, index) => {
        const selected = selection.includes(word)
        return (
          <button
            key={word}
            ref={(el) => {
              refs.current[index] = el
            }}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            tabIndex={index === rovingIndex ? 0 : -1}
            onFocus={() => setFocusIndex(index)}
            onKeyDown={(e) => onKeyDown(e, index)}
            onClick={() => onToggle(word)}
            className={cn(
              'cl-tile rounded-ds-sm border-2 font-headline font-bold uppercase',
              'transition-colors duration-100',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary',
              lengthClass(word),
              selected
                ? 'bg-on-surface text-surface-dim border-on-surface'
                : 'bg-surface-container-high text-on-surface border-outline-variant hover:border-outline',
              // Nothing is broken when the cap is reached; the tiles that
              // can still do something just stay the ones that look live.
              !selected && atCap && !disabled && 'opacity-70',
              disabled && 'opacity-60 cursor-default'
            )}
          >
            {word}
          </button>
        )
      })}
    </div>
  )
}
