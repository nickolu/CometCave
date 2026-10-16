'use client'

import { useRef } from 'react'

import { KNOBS, type KnobGroup } from '@/app/hum/lib/lessons'
import { DEFAULT_PATCH, type NumericKey, type Patch, fromUnit, toUnit } from '@/app/hum/lib/patch'

/* A rotary knob that is a real slider underneath (docs/hum-design.md §2.2).
   Drag up/down to turn — the same gesture on mouse and touch — arrows nudge,
   Shift+arrow jumps, Home/End go to the ends, double-click resets. */

const SWEEP = 270 // degrees of travel, from 7:30 round to 4:30
const R = 26

function polar(deg: number, r = R): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180
  return [32 + r * Math.cos(rad), 32 + r * Math.sin(rad)]
}

function arc(from: number, to: number): string {
  const [x1, y1] = polar(from)
  const [x2, y2] = polar(to)
  const large = to - from > 180 ? 1 : 0
  return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`
}

export function Knob({
  id,
  patch,
  readout,
  isNew,
  onChange,
  onTouch,
}: {
  id: NumericKey
  patch: Patch
  readout: string
  isNew: boolean
  onChange: (value: number) => void
  onTouch: () => void
}) {
  const info = KNOBS[id]
  const unit = toUnit(id, patch[id])
  const drag = useRef<{ y: number; unit: number } | null>(null)

  const set = (u: number) => onChange(fromUnit(id, u))

  const start = -SWEEP / 2
  const angle = start + unit * SWEEP

  return (
    <div className={`hum-knob hum-g-${info.group}${isNew ? ' hum-knob-new' : ''}`}>
      <div
        role="slider"
        tabIndex={0}
        aria-label={info.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(unit * 100)}
        aria-valuetext={readout}
        aria-describedby={`hum-hint-${id}`}
        className="hum-knob-dial"
        onFocus={onTouch}
        onPointerDown={e => {
          e.currentTarget.setPointerCapture(e.pointerId)
          e.currentTarget.focus()
          drag.current = { y: e.clientY, unit }
          onTouch()
        }}
        onPointerMove={e => {
          if (!drag.current) return
          const scale = e.shiftKey ? 800 : 200
          set(drag.current.unit + (drag.current.y - e.clientY) / scale)
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onDoubleClick={() => onChange(DEFAULT_PATCH[id])}
        onKeyDown={e => {
          const step = e.shiftKey ? 0.1 : 0.01
          const moves: Record<string, number> = {
            ArrowUp: unit + step,
            ArrowRight: unit + step,
            ArrowDown: unit - step,
            ArrowLeft: unit - step,
            PageUp: unit + 0.1,
            PageDown: unit - 0.1,
            Home: 0,
            End: 1,
          }
          if (e.key in moves) {
            e.preventDefault()
            set(moves[e.key])
          }
        }}
      >
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="21" className="hum-knob-cap" />
          <path d={arc(start, start + SWEEP)} className="hum-knob-track" />
          {unit > 0.002 && <path d={arc(start, angle)} className="hum-knob-value" />}
          <line
            x1={polar(angle, 9)[0]}
            y1={polar(angle, 9)[1]}
            x2={polar(angle, 18)[0]}
            y2={polar(angle, 18)[1]}
            className="hum-knob-pointer"
          />
        </svg>
      </div>
      <span className="hum-knob-label">{info.label}</span>
      <span className="hum-knob-readout" aria-hidden="true">
        {readout}
      </span>
      <span id={`hum-hint-${id}`} className="sr-only">
        {info.hint}
      </span>
    </div>
  )
}

/** A row of choices (wave shape, wobble target), drawn as a radio group. */
export function Choice<T extends string>({
  label,
  group,
  options,
  value,
  isNew,
  onChange,
  onTouch,
}: {
  label: string
  group: KnobGroup
  options: { value: T; label: string; icon?: React.ReactNode }[]
  value: T
  isNew: boolean
  onChange: (value: T) => void
  onTouch: () => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`hum-choice hum-g-${group}${isNew ? ' hum-knob-new' : ''}`}
    >
      <span className="hum-knob-label">{label}</span>
      <div className="hum-choice-row">
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            aria-label={o.label}
            title={o.label}
            className="hum-choice-btn"
            onClick={() => {
              onChange(o.value)
              onTouch()
            }}
          >
            {o.icon ?? o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function WaveIcon({ wave }: { wave: Patch['wave'] }) {
  const d = {
    sine: 'M2 12 C 6 2, 10 2, 14 12 S 22 22, 26 12',
    triangle: 'M2 12 L 8 4 L 20 20 L 26 12',
    square: 'M2 12 V 4 H 14 V 20 H 26 V 12',
    sawtooth: 'M2 20 L 14 4 V 20 L 26 4 V 12',
  }[wave]
  return (
    <svg viewBox="0 0 28 24" width="28" height="24" aria-hidden="true">
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
