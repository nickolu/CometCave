'use client'

/**
 * Where the player says what they do.
 *
 * The placeholder is load-bearing. This is a game with no buttons and no verb
 * list, so the input field is the only place the rules can say "describe an
 * attempt, not a command" — and a player who types "attack" instead of "I
 * swing the lantern at the rope" gets a worse story out of the same model. It
 * is written in the first person, as the sentence the player is about to type,
 * because the suggestion chips below speak in that voice and the field and the
 * chips have to be teaching the same grammar.
 *
 * Enter sends and Shift+Enter breaks the line, which is the convention every
 * player already has in their hands. The textarea grows with the text so a
 * long, considered action never scrolls inside a three-line box.
 */
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'

import { Suggestions } from '@/app/dicebound/components/suggestions'
import { MAX_ACTION } from '@/app/dicebound/domain/campaign'
import { ChunkyButton } from '@/components/ui/chunky-button'

const MAX_ROWS_PX = 200

export function Composer({
  onSend,
  disabled,
  suggestions = [],
}: {
  onSend: (text: string) => void
  disabled: boolean
  suggestions?: readonly string[]
}) {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  /** Set by a suggestion tap, read once by the effect that moves the caret. */
  const caretToEnd = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_ROWS_PX)}px`
  }, [value])

  // Focus returns to the field when the dungeon master finishes, so a player
  // reading the new paragraph can start typing without reaching for a mouse.
  useEffect(() => {
    if (!disabled) ref.current?.focus()
  }, [disabled])

  /**
   * A tapped suggestion, waiting to be edited.
   *
   * The caret has to be put at the end afterwards rather than here: React
   * writes the new value on the next render, and moving the caret before that
   * lands it at the end of whatever the field used to contain. Focus follows
   * for the same reason the field takes focus when the DM finishes — the edit
   * has to be one keystroke away, or nobody makes it and the chip has quietly
   * become a button that sends.
   */
  const fill = (text: string) => {
    caretToEnd.current = true
    setValue(text)
  }

  useEffect(() => {
    if (!caretToEnd.current) return
    caretToEnd.current = false
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [value])

  const send = () => {
    const text = value.trim()
    if (!text || disabled) return
    setValue('')
    onSend(text)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      send()
    }
  }

  return (
    <div className="border-t-2 border-outline-variant bg-surface-container-low px-4 py-4 md:px-8">
      <Suggestions suggestions={suggestions} onPick={fill} disabled={disabled} />
      <div className="mx-auto flex max-w-2xl items-end gap-3">
        <label htmlFor="dicebound-action" className="sr-only">
          What do you do?
        </label>
        <textarea
          id="dicebound-action"
          ref={ref}
          rows={1}
          value={value}
          maxLength={MAX_ACTION}
          disabled={disabled}
          onChange={event => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="I try to…"
          className="flex-1 resize-none rounded-ds-sm border-2 border-outline-variant bg-surface-container px-4 py-3 text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:border-ds-primary focus:outline-none disabled:opacity-50"
        />
        <ChunkyButton
          variant="primary"
          size="md"
          shape="block"
          onClick={send}
          disabled={disabled || !value.trim()}
          aria-label="Attempt it"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
            casino
          </span>
        </ChunkyButton>
      </div>
    </div>
  )
}
