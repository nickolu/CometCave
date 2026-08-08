'use client'
import { useState, useMemo } from 'react'
import { CHALLENGES } from '@/app/micro-land/domain/challenges'
import { loadSpeedRunRecords } from '@/app/micro-land/domain/speed-run-records'
import { resetTuning, setTuning } from '@/app/micro-land/domain/tuning'
import { useMicroLand } from '@/app/micro-land/store'
import { formatDuration } from '@/app/micro-land/format'

const ADAPTIVE_INITIAL_TARGET = 10

/**
 * Ways to make the land harder, in the shared right-hand column.
 *
 * Every one of these ends by closing the panel. A challenge is a change to the
 * world — new ground, new numbers, a clock started — and the thing you want to
 * be looking at the moment you start one is the world, not the list you started
 * it from.
 */
export function ChallengesPane() {
  const setSidebar = useMicroLand(s => s.setSidebar)
  const setChallengeActive = useMicroLand(s => s.setChallengeActive)
  const requestReshuffle = useMicroLand(s => s.requestReshuffle)
  const startAdaptiveRun = useMicroLand(s => s.startAdaptiveRun)
  const adaptiveRun = useMicroLand(s => s.adaptiveRun)
  const [targetGen, setTargetGen] = useState(10)
  const timeLimitOptions = [{ label: '3 min', seconds: 180 }, { label: '5 min', seconds: 300 }, { label: '10 min', seconds: 600 }]
  const [timeLimitIdx, setTimeLimitIdx] = useState(1)
  const startSpeedRun = useMicroLand(s => s.startSpeedRun)
  const elapsed = useMicroLand(s => s.elapsed)
  const speedRun = useMicroLand(s => s.speedRun)
  const [recordsEpoch, setRecordsEpoch] = useState(0)
  const records = useMemo(() => loadSpeedRunRecords(targetGen), [targetGen, recordsEpoch])

  function startChallenge(preset: (typeof CHALLENGES)[number]) {
    resetTuning()
    setTuning(preset.tuning)
    setChallengeActive({ name: preset.name, goal: preset.goal })
    requestReshuffle()
    setSidebar(null)
  }

  return (
    <div style={{ padding: '16px 16px 20px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {CHALLENGES.map(c => (
          <button
            key={c.id}
            type="button"
            className="cc-btn"
            onClick={() => startChallenge(c)}
            style={{
              display: 'block',
              textAlign: 'left',
              padding: '10px 14px',
              border: '1px solid var(--cc-mint-line)',
              borderRadius: 6,
              background: 'transparent',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--cc-font-mono)',
                fontSize: 11,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                color: 'var(--cc-mint)',
                marginBottom: 3,
              }}
            >
              {c.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--cc-text-muted)', marginBottom: 4 }}>
              {c.blurb}
            </div>
            <div
              style={{
                fontSize: 10,
                fontFamily: 'var(--cc-font-mono)',
                color: 'var(--cc-text-muted)',
                opacity: 0.7,
              }}
            >
              Goal: {c.goal}
            </div>
          </button>
        ))}
      </div>
      <div style={{ marginTop: 18, borderTop: '1px solid var(--cc-panel-divider)', paddingTop: 14 }}>
        <div style={{
          fontFamily: 'var(--cc-font-mono)', fontSize: 10, letterSpacing: 1.6,
          textTransform: 'uppercase', color: 'var(--cc-text-muted)', marginBottom: 10,
        }}>
          Speed Run
        </div>
        <div style={{ fontSize: 12, color: 'var(--cc-text-muted)', marginBottom: 10 }}>
          Race to keep a lineage alive to generation {targetGen} within the time limit.
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          {[10, 20, 30].map(g => (
            <button
              key={g}
              type="button"
              className="cc-btn"
              onClick={() => setTargetGen(g)}
              style={{
                fontFamily: 'var(--cc-font-mono)', fontSize: 10, letterSpacing: 1,
                textTransform: 'uppercase', padding: '3px 10px',
                border: `1px solid ${targetGen === g ? 'var(--cc-mint)' : 'var(--cc-panel-divider)'}`,
                color: targetGen === g ? 'var(--cc-mint)' : 'var(--cc-text-muted)',
              }}
            >
              gen {g}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {timeLimitOptions.map((opt, i) => (
            <button
              key={opt.label}
              type="button"
              className="cc-btn"
              onClick={() => setTimeLimitIdx(i)}
              style={{
                fontFamily: 'var(--cc-font-mono)', fontSize: 10, letterSpacing: 1,
                textTransform: 'uppercase', padding: '3px 10px',
                border: `1px solid ${timeLimitIdx === i ? 'var(--cc-mint)' : 'var(--cc-panel-divider)'}`,
                color: timeLimitIdx === i ? 'var(--cc-mint)' : 'var(--cc-text-muted)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="cc-btn"
          onClick={() => {
            startSpeedRun(targetGen, timeLimitOptions[timeLimitIdx].seconds, elapsed)
            setRecordsEpoch(e => e + 1)
            setSidebar(null)
          }}
          style={{
            fontFamily: 'var(--cc-font-mono)', fontSize: 10, letterSpacing: 1.2,
            textTransform: 'uppercase', padding: '5px 14px',
            border: '1px solid var(--cc-mint)',
            color: 'var(--cc-mint)',
            display: 'block',
          }}
        >
          {speedRun.active ? 'Restart Speed Run' : 'Start Speed Run'}
        </button>
        {records.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{
              fontFamily: 'var(--cc-font-mono)', fontSize: 9, letterSpacing: 1.2,
              textTransform: 'uppercase', color: 'var(--cc-text-muted)',
              opacity: 0.7, marginBottom: 6,
            }}>
              Best times — gen {targetGen}
            </div>
            <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {records.slice(0, 5).map((r, i) => (
                <li
                  key={i}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                    fontFamily: 'var(--cc-font-mono)', fontSize: 11,
                    color: i === 0 ? 'var(--cc-gold)' : 'var(--cc-text-muted)',
                  }}
                >
                  <span>{i + 1}. {formatDuration(r.seconds)}</span>
                  <span style={{ fontSize: 9, opacity: 0.6 }}>{r.theme} · {r.date}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* Adaptive Mode */}
      <div style={{ marginTop: 18, borderTop: '1px solid var(--cc-panel-divider)', paddingTop: 14 }}>
        <div style={{
          fontFamily: 'var(--cc-font-mono)', fontSize: 10, letterSpacing: 1.6,
          textTransform: 'uppercase', color: 'var(--cc-text-muted)', marginBottom: 10,
        }}>
          Adaptive Mode
        </div>
        <div style={{ fontSize: 12, color: 'var(--cc-text-muted)', marginBottom: 10 }}>
          The world sets a target population and adjusts it as your ecosystem grows or struggles.
          Sustain the goal for 60 seconds to win.
        </div>
        <button
          type="button"
          className="cc-btn"
          onClick={() => {
            startAdaptiveRun(ADAPTIVE_INITIAL_TARGET)
            setSidebar(null)
          }}
          style={{
            fontFamily: 'var(--cc-font-mono)', fontSize: 10, letterSpacing: 1.2,
            textTransform: 'uppercase', padding: '5px 14px',
            border: `1px solid ${adaptiveRun.active ? 'var(--cc-gold)' : 'var(--cc-mint)'}`,
            color: adaptiveRun.active ? 'var(--cc-gold)' : 'var(--cc-mint)',
            display: 'block',
          }}
        >
          {adaptiveRun.active ? 'Restart Adaptive Mode' : 'Start Adaptive Mode'}
        </button>
      </div>

    </div>
  )
}
