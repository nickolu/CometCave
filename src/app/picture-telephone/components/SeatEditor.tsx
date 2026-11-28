'use client'

import { PERSONALITIES, getPersonality, seatId } from '@/lib/picture-telephone/personalities'
import { MAX_SEATS, MIN_SEATS, NAME_MAX, defaultSeatName } from '@/lib/picture-telephone/settings'

import type { Seat } from '@/lib/picture-telephone/types'

function nextSeatId(seats: Seat[]): string {
  const max = seats.reduce((m, s) => Math.max(m, Number(s.id.replace('seat-', '')) || 0), 0)
  return seatId(max + 1)
}

export function SeatEditor({ seats, onChange }: { seats: Seat[]; onChange: (seats: Seat[]) => void }) {
  const humans = seats.filter(s => s.kind === 'human').length
  const full = seats.length >= MAX_SEATS

  const update = (id: string, patch: Partial<Seat>) =>
    onChange(seats.map(s => (s.id === id ? { ...s, ...patch } : s)))

  const setKind = (seat: Seat, kind: Seat['kind']) => {
    if (kind === seat.kind) return
    const index = seats.indexOf(seat)
    if (kind === 'ai') {
      const personalityId = PERSONALITIES[index % PERSONALITIES.length].id
      update(seat.id, { kind, personalityId, name: defaultSeatName(index, 'ai', personalityId) })
    } else {
      update(seat.id, { kind, personalityId: undefined, name: defaultSeatName(index, 'human') })
    }
  }

  const setPersonality = (seat: Seat, personalityId: string) => {
    const wasDefault = seat.name === getPersonality(seat.personalityId).name
    update(seat.id, {
      personalityId,
      ...(wasDefault ? { name: getPersonality(personalityId).name } : {}),
    })
  }

  const add = (kind: Seat['kind']) => {
    if (full) return
    const index = seats.length
    const personalityId = kind === 'ai' ? PERSONALITIES[index % PERSONALITIES.length].id : undefined
    onChange([
      ...seats,
      { id: nextSeatId(seats), kind, name: defaultSeatName(index, kind, personalityId), personalityId },
    ])
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="pt-seats" aria-label="Players">
        {seats.map((seat, i) => {
          const onlyHuman = seat.kind === 'human' && humans <= 1
          return (
            <li key={seat.id} className="pt-seat">
              <div className="pt-seat-row">
                <label className="sr-only" htmlFor={`pt-name-${seat.id}`}>
                  Name of player {i + 1}
                </label>
                <span aria-hidden className="text-2xl">
                  {seat.kind === 'ai' ? getPersonality(seat.personalityId).emoji : '🙂'}
                </span>
                <input
                  id={`pt-name-${seat.id}`}
                  className="pt-input flex-1"
                  value={seat.name}
                  maxLength={NAME_MAX}
                  onChange={e => update(seat.id, { name: e.target.value })}
                />
              </div>

              <div className="pt-seat-row" role="group" aria-label={`Who plays ${seat.name || `seat ${i + 1}`}`}>
                <button
                  type="button"
                  className="pt-chip"
                  aria-pressed={seat.kind === 'human'}
                  onClick={() => setKind(seat, 'human')}
                >
                  Person
                </button>
                <button
                  type="button"
                  className="pt-chip"
                  aria-pressed={seat.kind === 'ai'}
                  disabled={onlyHuman}
                  onClick={() => setKind(seat, 'ai')}
                >
                  AI
                </button>
                {seat.kind === 'ai' && (
                  <>
                    <label className="sr-only" htmlFor={`pt-persona-${seat.id}`}>
                      Personality for {seat.name}
                    </label>
                    <select
                      id={`pt-persona-${seat.id}`}
                      className="pt-select"
                      style={{ width: 'auto' }}
                      value={seat.personalityId}
                      onChange={e => setPersonality(seat, e.target.value)}
                    >
                      {PERSONALITIES.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.emoji} {p.name}: {p.blurb}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>

              <button
                type="button"
                className="pt-chip"
                aria-label={`Remove ${seat.name || `player ${i + 1}`}`}
                disabled={seats.length <= MIN_SEATS || onlyHuman}
                onClick={() => onChange(seats.filter(s => s.id !== seat.id))}
              >
                Remove
              </button>
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap gap-3">
        <button type="button" className="pt-chip" disabled={full} onClick={() => add('human')}>
          + Add a person
        </button>
        <button type="button" className="pt-chip" disabled={full} onClick={() => add('ai')}>
          + Add an AI player
        </button>
      </div>
    </div>
  )
}
