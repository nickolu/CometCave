'use client'

import { useMemo, useState } from 'react'

import {
  COURSE,
  type CourseItem,
  type CoursePhase,
  type ItemType,
} from '@/lib/voice-journey/curriculum'

import { type SyncState, localDayKey, todayLocal, useProgress } from './use-progress'

const TYPE_META: Record<ItemType, { label: string; color: string; bg: string }> = {
  warmup: { label: 'Warm-up', color: 'var(--vj-amber)', bg: 'var(--vj-warmup-bg)' },
  concept: { label: 'Learn', color: 'var(--vj-purple)', bg: 'var(--vj-learn-bg)' },
  song: { label: 'Sing it', color: 'var(--vj-pink)', bg: 'var(--vj-song-bg)' },
}

const SOLFEGE = ['do', 're', 'mi', 'fa', 'sol', 'la', 'ti', 'do']
/** Four weeks of dots on the Progress tab. */
const GRID_DAYS = 28

/** A rising scale that fills as she works — the page's one signature drawing. */
function ScaleMeter({ fraction, width = 240 }: { fraction: number; width?: number }) {
  const n = SOLFEGE.length
  const filled = Math.round(fraction * n)
  const h = 64
  return (
    <svg
      viewBox={`0 0 ${width} ${h}`}
      width="100%"
      style={{ maxWidth: width, display: 'block' }}
      role="img"
      aria-label={`Progress: ${Math.round(fraction * 100)} percent`}
    >
      {SOLFEGE.map((s, i) => {
        const x = 14 + (i * (width - 28)) / (n - 1)
        const y = h - 16 - (i * (h - 34)) / (n - 1)
        const done = i < filled
        return (
          <g key={`${s}-${i}`}>
            {i < n - 1 && (
              <line
                x1={x}
                y1={y}
                x2={14 + ((i + 1) * (width - 28)) / (n - 1)}
                y2={h - 16 - ((i + 1) * (h - 34)) / (n - 1)}
                stroke={i < filled - 1 ? 'var(--vj-purple)' : 'var(--vj-line)'}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            )}
            <circle
              cx={x}
              cy={y}
              r={done ? 7 : 5.5}
              fill={done ? 'var(--vj-purple)' : 'var(--vj-card)'}
              stroke={done ? 'var(--vj-purple)' : 'var(--vj-line-strong)'}
              strokeWidth="2"
            />
            <text
              x={x}
              y={h - 2}
              textAnchor="middle"
              fontSize="9"
              fontWeight="800"
              fill={done ? 'var(--vj-ink)' : 'var(--vj-ghost)'}
            >
              {s}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** Quiet unless something needs saying — a save in flight should not shout. */
function SyncBadge({ state }: { state: SyncState }) {
  if (state === 'saved') return null
  const saving = state === 'saving'
  return (
    <div
      role="status"
      style={{
        fontSize: 12,
        fontWeight: 800,
        color: saving ? 'var(--vj-saving-fg)' : 'var(--vj-offline-fg)',
        background: saving ? 'var(--vj-saving-bg)' : 'var(--vj-offline-bg)',
        borderRadius: 999,
        padding: '4px 12px',
        marginBottom: 12,
        display: 'inline-block',
      }}
    >
      {saving ? 'Saving…' : 'Saved on this device — will sync when you’re back online'}
    </div>
  )
}

const CARD: React.CSSProperties = {
  background: 'var(--vj-card)',
  borderRadius: 20,
  padding: 20,
  boxShadow: '0 2px 10px rgba(124,58,237,0.08)',
}

/**
 * The page's own world: its palette, its reset, its scope.
 *
 * The colors live here as custom properties rather than inline hex, both
 * because the repo's lint rule requires it and because this palette is
 * deliberately *not* the cave's design system — it is the look she picked, kept
 * behind one id so it cannot leak into anything else.
 */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      id="voice-journey"
      style={{
        minHeight: '100dvh',
        background: 'var(--vj-bg)',
        color: 'var(--vj-ink)',
        fontFamily: 'var(--font-voice-body), sans-serif',
      }}
    >
      <style>{`
        #voice-journey {
          --vj-bg: #FBF8FF;
          --vj-card: #ffffff;
          --vj-ink: #2A1E3F;
          --vj-purple: #7C3AED;
          --vj-purple-soft: #A855F7;
          --vj-pink: #FF5E8A;
          --vj-amber: #FFB020;
          --vj-green: #1F9E7A;
          --vj-muted: #5C4B7D;
          --vj-faded: #8578A3;
          --vj-disabled: #6B5C89;
          --vj-ghost: #A79BC2;
          --vj-lilac: #EFE8FA;
          --vj-lilac-dim: #F0EAFB;
          --vj-line: #E4DAF6;
          --vj-line-strong: #CBBBEA;
          --vj-underline: #E0D5F5;
          --vj-warmup-bg: #FFF4DC;
          --vj-learn-bg: #F0E8FF;
          --vj-song-bg: #FFE7EE;
          --vj-saving-bg: #F4EEFC;
          --vj-saving-fg: #8A7BA8;
          --vj-offline-bg: #FDE8E7;
          --vj-offline-fg: #B4453F;
        }
        #voice-journey * { box-sizing: border-box; }
        #voice-journey button { cursor: pointer; font-family: inherit; }
        #voice-journey a { color: inherit; }
        #voice-journey .tabbtn:focus-visible,
        #voice-journey .itemrow:focus-visible,
        #voice-journey .bigbtn:focus-visible,
        #voice-journey a:focus-visible { outline: 3px solid var(--vj-purple); outline-offset: 2px; border-radius: 6px; }
        @keyframes voice-pop { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }
        #voice-journey .celebrate { animation: voice-pop 0.5s ease; }
        @media (prefers-reduced-motion: reduce) { #voice-journey .celebrate { animation: none; } }
      `}</style>
      {children}
    </div>
  )
}

type Tab = 'today' | 'course' | 'progress'

export default function VoiceJourneyPage() {
  const { completed, log, ready, sync, toggleItem, logToday } = useProgress()
  const [tab, setTab] = useState<Tab>('today')
  const [openPhase, setOpenPhase] = useState<string | null>('p1')
  const [celebrate, setCelebrate] = useState(false)

  const allWeeks = useMemo(() => COURSE.flatMap(p => p.weeks.map(w => ({ ...w, phase: p }))), [])
  const allItems = useMemo(() => allWeeks.flatMap(w => w.items), [allWeeks])

  // The first week with anything left in it — falls back to the last week so a
  // finished course still has something to show.
  const currentWeek = useMemo(
    () => allWeeks.find(w => w.items.some(i => !completed[i.id])) ?? allWeeks[allWeeks.length - 1],
    [allWeeks, completed]
  )
  const nextItem = currentWeek.items.find(i => !completed[i.id])

  const streak = useMemo(() => {
    const days = new Set(log)
    const cursor = new Date()
    // A day with no practice yet does not break the streak until it is over.
    if (!days.has(todayLocal())) cursor.setDate(cursor.getDate() - 1)
    let count = 0
    while (days.has(localDayKey(cursor))) {
      count++
      cursor.setDate(cursor.getDate() - 1)
    }
    return count
  }, [log])

  const practicedToday = log.includes(todayLocal())
  const totalDone = allItems.filter(i => completed[i.id]).length
  const totalItems = allItems.length

  const phaseFraction = (phase: CoursePhase) => {
    const items = phase.weeks.flatMap(w => w.items)
    return items.filter(i => completed[i.id]).length / items.length
  }

  const onLogPractice = () => {
    if (!logToday()) return
    setCelebrate(true)
    setTimeout(() => setCelebrate(false), 1600)
  }

  if (!ready) {
    return (
      <Shell>
        <div style={{ padding: 40, color: 'var(--vj-purple)', fontWeight: 800 }}>Warming up…</div>
      </Shell>
    )
  }

  return (
    <Shell>
      <header
        style={{
          background:
            'linear-gradient(120deg, var(--vj-purple) 0%, var(--vj-purple-soft) 55%, var(--vj-pink) 130%)',
          color: 'var(--vj-card)',
          padding: '28px 20px 22px',
          borderRadius: '0 0 28px 28px',
        }}
      >
        <div
          style={{
            maxWidth: 680,
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: 'var(--font-voice-display), sans-serif',
                fontWeight: 700,
                fontSize: 28,
                lineHeight: 1.1,
                margin: 0,
              }}
            >
              My Voice Journey
            </h1>
            <div style={{ opacity: 0.9, fontWeight: 700, fontSize: 13, marginTop: 4 }}>
              {currentWeek.phase.name} · {currentWeek.label} · {totalDone}/{totalItems} steps done
            </div>
          </div>
          <div
            style={{
              background: 'rgba(255,255,255,0.18)',
              borderRadius: 16,
              padding: '8px 14px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-voice-display), sans-serif',
                fontSize: 24,
                fontWeight: 700,
              }}
            >
              🔥 {streak}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}
            >
              day streak
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 680, margin: '0 auto', padding: '18px 16px 60px' }}>
        <SyncBadge state={sync} />

        <nav style={{ display: 'flex', gap: 8, marginBottom: 18 }} aria-label="Sections">
          {(
            [
              ['today', 'Today'],
              ['course', 'Course map'],
              ['progress', 'Progress'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className="tabbtn"
              onClick={() => setTab(key)}
              aria-current={tab === key ? 'page' : undefined}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 14,
                border: 'none',
                fontWeight: 800,
                fontSize: 14,
                background: tab === key ? 'var(--vj-ink)' : 'var(--vj-lilac)',
                color: tab === key ? 'var(--vj-card)' : 'var(--vj-muted)',
              }}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === 'today' && (
          <section>
            <div style={{ ...CARD, marginBottom: 14 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  color: 'var(--vj-purple)',
                }}
              >
                Up next · {currentWeek.phase.name}, {currentWeek.label}
              </div>
              {nextItem ? (
                <>
                  <div
                    style={{
                      fontFamily: 'var(--font-voice-display), sans-serif',
                      fontSize: 22,
                      fontWeight: 600,
                      margin: '8px 0 4px',
                    }}
                  >
                    {nextItem.title}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: 'var(--vj-muted)',
                      marginBottom: 14,
                    }}
                  >
                    <span
                      style={{
                        background: TYPE_META[nextItem.type].bg,
                        color: TYPE_META[nextItem.type].color,
                        padding: '3px 10px',
                        borderRadius: 999,
                        fontWeight: 800,
                        marginRight: 8,
                      }}
                    >
                      {TYPE_META[nextItem.type].label}
                    </span>
                    about {nextItem.min} min
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <a
                      href={nextItem.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        background: 'var(--vj-pink)',
                        color: 'var(--vj-card)',
                        textDecoration: 'none',
                        fontWeight: 800,
                        padding: '12px 18px',
                        borderRadius: 14,
                      }}
                    >
                      ▶ Watch on YouTube
                    </a>
                    <button
                      type="button"
                      className="bigbtn"
                      onClick={() => toggleItem(nextItem.id)}
                      style={{
                        background: 'var(--vj-green)',
                        color: 'var(--vj-card)',
                        border: 'none',
                        fontWeight: 800,
                        padding: '12px 18px',
                        borderRadius: 14,
                        fontSize: 14,
                      }}
                    >
                      ✓ Done!
                    </button>
                  </div>
                </>
              ) : (
                <div
                  style={{
                    fontFamily: 'var(--font-voice-display), sans-serif',
                    fontSize: 20,
                    marginTop: 8,
                  }}
                >
                  Course complete — encore! 🎤
                </div>
              )}
            </div>

            <div style={CARD}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: 'var(--font-voice-display), sans-serif',
                      fontSize: 18,
                      fontWeight: 600,
                    }}
                  >
                    Did you practice today?
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--vj-muted)' }}>
                    Even 10 minutes counts.
                  </div>
                </div>
                <button
                  type="button"
                  className="bigbtn"
                  onClick={onLogPractice}
                  disabled={practicedToday}
                  style={{
                    background: practicedToday ? 'var(--vj-lilac)' : 'var(--vj-amber)',
                    color: practicedToday ? 'var(--vj-disabled)' : 'var(--vj-ink)',
                    border: 'none',
                    fontWeight: 800,
                    padding: '12px 18px',
                    borderRadius: 14,
                    fontSize: 14,
                    cursor: practicedToday ? 'default' : 'pointer',
                  }}
                >
                  {practicedToday ? 'Logged ✓' : 'I practiced! 🎵'}
                </button>
              </div>
              {celebrate && (
                <div
                  className="celebrate"
                  style={{
                    marginTop: 12,
                    fontFamily: 'var(--font-voice-display), sans-serif',
                    fontSize: 18,
                    color: 'var(--vj-purple)',
                  }}
                >
                  🔥 Streak: {streak} day{streak === 1 ? '' : 's'} — keep singing!
                </div>
              )}
            </div>
          </section>
        )}

        {tab === 'course' && (
          <section>
            {COURSE.map((phase, pi) => {
              const open = openPhase === phase.id
              return (
                <div
                  key={phase.id}
                  style={{ ...CARD, padding: 0, marginBottom: 14, overflow: 'hidden' }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenPhase(open ? null : phase.id)}
                    aria-expanded={open}
                    className="tabbtn"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      padding: 18,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            letterSpacing: 1,
                            textTransform: 'uppercase',
                            color: 'var(--vj-purple)',
                          }}
                        >
                          Phase {pi + 1}
                        </div>
                        <div
                          style={{
                            fontFamily: 'var(--font-voice-display), sans-serif',
                            fontSize: 20,
                            fontWeight: 600,
                          }}
                        >
                          {phase.name}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--vj-muted)' }}>
                          {phase.tagline}
                        </div>
                      </div>
                      <div
                        aria-hidden="true"
                        style={{
                          fontFamily: 'var(--font-voice-display), sans-serif',
                          fontSize: 18,
                          color: 'var(--vj-purple)',
                        }}
                      >
                        {open ? '–' : '+'}
                      </div>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <ScaleMeter fraction={phaseFraction(phase)} />
                    </div>
                  </button>

                  {open &&
                    phase.weeks.map(week => (
                      <div
                        key={week.id}
                        style={{
                          borderTop: '1.5px solid var(--vj-lilac-dim)',
                          padding: '12px 18px',
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: 13,
                            color: 'var(--vj-muted)',
                            marginBottom: 8,
                          }}
                        >
                          {week.label}
                        </div>
                        {week.items.map((item: CourseItem) => {
                          const done = !!completed[item.id]
                          const meta = TYPE_META[item.type]
                          return (
                            <div
                              key={item.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '7px 0',
                              }}
                            >
                              <button
                                type="button"
                                className="itemrow"
                                onClick={() => toggleItem(item.id)}
                                aria-pressed={done}
                                aria-label={`${item.title} — ${done ? 'done' : 'not done yet'}`}
                                style={{
                                  width: 26,
                                  height: 26,
                                  borderRadius: 9,
                                  flexShrink: 0,
                                  border: `2.5px solid ${done ? 'var(--vj-green)' : 'var(--vj-line-strong)'}`,
                                  background: done ? 'var(--vj-green)' : 'var(--vj-card)',
                                  color: 'var(--vj-card)',
                                  fontWeight: 900,
                                  fontSize: 14,
                                  lineHeight: 1,
                                }}
                              >
                                {done ? '✓' : ''}
                              </button>
                              <span
                                style={{
                                  background: meta.bg,
                                  color: meta.color,
                                  padding: '2px 8px',
                                  borderRadius: 999,
                                  fontSize: 11,
                                  fontWeight: 800,
                                  flexShrink: 0,
                                }}
                              >
                                {meta.label}
                              </span>
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  fontSize: 14,
                                  fontWeight: 700,
                                  // Longhand, not the `textDecoration` shorthand: React warns
                                  // when a shorthand and a longhand for the same property both
                                  // change on a rerender, and this row does exactly that.
                                  textDecorationLine: done ? 'line-through' : 'underline',
                                  textDecorationColor: 'var(--vj-underline)',
                                  color: done ? 'var(--vj-faded)' : 'var(--vj-ink)',
                                }}
                              >
                                {item.title}
                              </a>
                            </div>
                          )
                        })}
                      </div>
                    ))}
                </div>
              )
            })}
          </section>
        )}

        {tab === 'progress' && (
          <section>
            <div style={{ ...CARD, marginBottom: 14 }}>
              <h2
                style={{
                  fontFamily: 'var(--font-voice-display), sans-serif',
                  fontSize: 20,
                  fontWeight: 600,
                  marginBottom: 6,
                  marginTop: 0,
                }}
              >
                The whole journey
              </h2>
              <ScaleMeter fraction={totalDone / totalItems} width={360} />
              <div
                style={{ fontWeight: 800, fontSize: 13, color: 'var(--vj-muted)', marginTop: 6 }}
              >
                {totalDone} of {totalItems} steps · {Math.round((totalDone / totalItems) * 100)}%
              </div>
            </div>

            <div style={CARD}>
              <h2
                style={{
                  fontFamily: 'var(--font-voice-display), sans-serif',
                  fontSize: 20,
                  fontWeight: 600,
                  marginBottom: 10,
                  marginTop: 0,
                }}
              >
                Practice days
              </h2>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {Array.from({ length: GRID_DAYS }).map((_, i) => {
                  const d = new Date()
                  d.setDate(d.getDate() - (GRID_DAYS - 1 - i))
                  const key = localDayKey(d)
                  const hit = log.includes(key)
                  return (
                    <div
                      key={key}
                      title={`${key} — ${hit ? 'practiced' : 'no practice'}`}
                      role="img"
                      aria-label={`${key}, ${hit ? 'practiced' : 'no practice'}`}
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 6,
                        background: hit ? 'var(--vj-amber)' : 'var(--vj-lilac-dim)',
                        border: hit ? 'none' : '1.5px solid var(--vj-line)',
                      }}
                    />
                  )
                })}
              </div>
              <div
                style={{ fontWeight: 800, fontSize: 13, color: 'var(--vj-muted)', marginTop: 10 }}
              >
                Last 4 weeks · {log.length} total practice day{log.length === 1 ? '' : 's'} ·
                current streak 🔥 {streak}
              </div>
            </div>
          </section>
        )}
      </main>
    </Shell>
  )
}
