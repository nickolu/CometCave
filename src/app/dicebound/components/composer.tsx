'use client'

/**
 * Where the player says what they do.
 *
 * The placeholder is load-bearing. This is a game with no buttons and no verb
 * list, so the input field is the only place the rules can say "describe an
 * attempt, not a command" — and a player who types "attack" instead of "I
 * swing the lantern at the rope" gets a worse story out of the same model.
 *
 * Enter sends and Shift+Enter breaks the line, which is the convention every
 * player already has in their hands. The textarea grows with the text so a
 * long, considered action never scrolls inside a three-line box.
 */
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'

import { MAX_ACTION } from '@/app/dicebound/domain/campaign'
import { ChunkyButton } from '@/components/ui/chunky-button'

const MAX_ROWS_PX = 200

export function Composer({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void
  disabled: boolean
}) {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

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
          placeholder="You try to…"
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
