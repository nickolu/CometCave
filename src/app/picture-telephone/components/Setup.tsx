'use client'

import { useEffect, useRef, useState } from 'react'

import { AiGate } from '@/components/ai-gate'
import { ChunkyButton } from '@/components/ui/chunky-button'
import { type SeatMode, defaultSeats } from '@/lib/picture-telephone/personalities'
import { isMockProvider } from '@/lib/picture-telephone/provider'
import {
  DEFAULT_CHAIN,
  MAX_CHAIN,
  MAX_SEATS,
  MIN_CHAIN,
  MIN_SEATS,
  cleanName,
  validateSettings,
} from '@/lib/picture-telephone/settings'

import { SeatEditor } from './SeatEditor'

import type { Seat, Settings } from '@/lib/picture-telephone/types'

/** Why pictures are off, or null. A failed lookup never blocks play: the server says no on its own. */
function useImagesOffReason(enabled: boolean): string | null {
  const [reason, setReason] = useState<string | null>(null)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    fetch('/api/v1/image-generation-status')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || !data) return
        if (data.allowed === false && !data.pictureTelephoneMock) {
          setReason(typeof data.disableReason === 'string' ? data.disableReason : 'Pictures are switched off right now.')
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [enabled])
  return reason
}

export function Setup({ onStart }: { onStart: (settings: Settings) => void }) {
  const [mode, setMode] = useState<SeatMode>('solo')
  const [seats, setSeats] = useState<Seat[]>(() => defaultSeats('solo'))
  const [chainLength, setChainLength] = useState(DEFAULT_CHAIN)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const mock = isMockProvider()
  const imagesOff = useImagesOffReason(!mock)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const pickMode = (next: SeatMode) => {
    setMode(next)
    setSeats(defaultSeats(next))
  }

  const settings: Settings = {
    seats: seats.map(s => ({ ...s, name: cleanName(s.name) })),
    chainLength,
  }
  const check = validateSettings(settings)

  const startButton = (
    <ChunkyButton size="hero" disabled={!check.ok || imagesOff !== null} onClick={() => check.ok && onStart(settings)}>
      Start
    </ChunkyButton>
  )

  return (
    <section className="flex flex-1 flex-col gap-5" aria-labelledby="pt-setup-heading">
      <div className="flex flex-col gap-2">
        <h1 id="pt-setup-heading" ref={headingRef} tabIndex={-1} className="pt-heading">
          Picture Telephone
        </h1>
        <ol className="pt-rules">
          <li>Someone writes a sentence and it turns into a picture.</li>
          <li>The next player sees only that picture and writes what they see.</li>
          <li>Keep passing it along, then watch how far it drifted.</li>
        </ol>
      </div>

      <div className="pt-panel">
        <div role="group" aria-label="Game type" className="flex flex-wrap gap-3">
          <button type="button" className="pt-chip" aria-pressed={mode === 'solo'} onClick={() => pickMode('solo')}>
            Just me and AI players
          </button>
          <button type="button" className="pt-chip" aria-pressed={mode === 'group'} onClick={() => pickMode('group')}>
            With friends
          </button>
        </div>
        <p className="pt-sub">
          {mode === 'solo'
            ? 'You and three AI players take turns. Add or change players below.'
            : `Pass one device around. ${MIN_SEATS} to ${MAX_SEATS} players; AI players are optional.`}
        </p>
        <SeatEditor seats={seats} onChange={setSeats} />
      </div>

      <div className="pt-panel">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-label text-sm font-bold uppercase tracking-widest">Pictures in the chain</p>
            <p className="pt-sub">More pictures means a longer game and a bigger drift.</p>
          </div>
          <div className="pt-stepper">
            <button
              type="button"
              className="pt-chip"
              aria-label="Fewer pictures"
              disabled={chainLength <= MIN_CHAIN}
              onClick={() => setChainLength(n => Math.max(MIN_CHAIN, n - 1))}
            >
              −
            </button>
            <output aria-live="polite" aria-label="Pictures">
              {chainLength}
            </output>
            <button
              type="button"
              className="pt-chip"
              aria-label="More pictures"
              disabled={chainLength >= MAX_CHAIN}
              onClick={() => setChainLength(n => Math.min(MAX_CHAIN, n + 1))}
            >
              +
            </button>
          </div>
        </div>
      </div>

      {!check.ok && (
        <p role="alert" className="pt-notice">
          {check.error}
        </p>
      )}

      {imagesOff && (
        <p role="alert" className="pt-notice">
          {imagesOff}
        </p>
      )}

      <div className="pt-actions pt-actions-sticky">
        {mock ? (
          startButton
        ) : (
          <AiGate game="Picture Telephone" redirectTo="/picture-telephone" what="play" compact>
            {startButton}
          </AiGate>
        )}
      </div>
    </section>
  )
}
