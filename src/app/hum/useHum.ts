'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { type Engine, Voice, playNote, unlockEngine } from './lib/audio'
import {
  type Beat,
  MAX_SOUND_ROWS,
  OFF,
  type Row,
  STEPS,
  newSoundRow,
  rowFreq,
  soundRows,
  stepSeconds,
} from './lib/beat'
import { ALL_KNOBS, GRID_UNLOCK_LESSON, type KnobId, LESSONS, unlockedKnobs } from './lib/lessons'
import { type Patch } from './lib/patch'
import { Sequencer } from './lib/sequencer'
import { type Shared, encodeShared, sharedFromHash } from './lib/share'
import { type HumState, LIBRARY_MAX, freshState, loadState, saveState } from './lib/storage'

import type { ScopeView } from './components/Scope'

const BEAT_OPEN_KEY = 'hum:beat-open'

/** What the knobs are editing: the lesson sound, or one row of the beat. */
export type Target = 'sound' | string

interface LessonProgress {
  index: number
  goal: number
  start: Patch
  done: boolean
}

export function useHum() {
  const [state, setState] = useState<HumState>(freshState)
  const [loaded, setLoaded] = useState(false)
  /** A beat opened from someone's link. Played and edited in memory only;
   *  the player's own beat is untouched until they choose to keep it. */
  const [visiting, setVisiting] = useState<Shared | null>(null)
  const [chosenTarget, setTarget] = useState<Target>('sound')
  const [view, setView] = useState<ScopeView>('close')
  const [playing, setPlaying] = useState(false)
  const [hold, setHold] = useState(false)
  const [muted, setMutedState] = useState(false)
  const [beatOn, setBeatOn] = useState(false)
  const [step, setStep] = useState(-1)
  const [engine, setEngine] = useState<Engine | null>(null)
  const [lesson, setLesson] = useState<LessonProgress | null>(null)
  const [touched, setTouched] = useState<KnobId | null>(null)
  const memo = useRef<Record<string, number>>({})
  // Collapsed or open is a per-browser convenience, not part of the beat.
  const [beatOpen, setBeatOpenState] = useState(true)

  // --- Load / save ------------------------------------------------------

  // Storage is only readable after hydration, so loading is an effect.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(loadState(LESSONS.length))
    const shared = sharedFromHash(window.location.hash)
    if (shared) setVisiting(shared)
    try {
      if (localStorage.getItem(BEAT_OPEN_KEY) === '0') setBeatOpenState(false)
    } catch {
      // Storage unavailable: open is the default.
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (loaded) saveState(state)
  }, [state, loaded])

  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const beat = visiting?.beat ?? state.beat
  const sound = visiting?.sound ?? state.sound

  const updateBeat = useCallback(
    (fn: (b: Beat) => Beat) => {
      if (visiting) setVisiting(v => (v ? { ...v, beat: fn(v.beat) } : v))
      else setState(s => ({ ...s, beat: fn(s.beat) }))
    },
    [visiting]
  )

  const updateSound = useCallback(
    (fn: (p: Patch) => Patch) => {
      if (visiting) setVisiting(v => (v ? { ...v, sound: fn(v.sound) } : v))
      else setState(s => ({ ...s, sound: fn(s.sound) }))
    },
    [visiting]
  )

  // --- Lessons ------------------------------------------------------------

  const studio = state.studio || state.completed >= LESSONS.length
  const lessonIndex = loaded && !visiting && !studio ? state.completed : null

  // Starting a lesson sets the stage: its knob values, its scope view, and
  // the lesson sound on the knobs.
  // lessonIndex changes from three places (load, finishing, leaving the
  // studio); setting the stage here keeps that in one spot.
  useEffect(() => {
    if (lessonIndex === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLesson(null)
      return
    }
    const l = LESSONS[lessonIndex]
    const start = { ...stateRef.current.sound, ...l.setup }
    // Only lesson 1 begins in silence; every later one needs to be heard.
    if (lessonIndex > 0 && start.volume < 0.1) start.volume = 0.5
    memo.current = {}
    setTarget('sound')
    setView(l.view)
    setLesson({ index: lessonIndex, goal: 0, start, done: false })
    setState(s => ({ ...s, sound: start }))
  }, [lessonIndex])

  // Goals watch the lesson sound only, not a beat row being edited.
  const editingRow = chosenTarget !== 'sound' && beat.rows.some(r => r.id === chosenTarget)

  // Check the current goal whenever anything it could depend on changes.
  useEffect(() => {
    if (!lesson || lesson.done || editingRow) return
    const l = LESSONS[lesson.index]
    const goal = l.goals[lesson.goal]
    if (!goal) return
    if (
      goal.check({
        patch: state.sound,
        start: lesson.start,
        playing,
        bpm: beat.bpm,
        memo: memo.current,
      })
    ) {
      const next = lesson.goal + 1
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLesson({ ...lesson, goal: next, done: next >= l.goals.length })
    }
  }, [lesson, state.sound, playing, beat.bpm, editingRow])

  const nextLesson = useCallback(() => {
    setState(s => {
      // Finishing the envelope lesson is when the lesson sound earns its
      // row on the beat grid — the lesson's takeaway promises it.
      const joins = s.completed === GRID_UNLOCK_LESSON && soundRows(s.beat).length < MAX_SOUND_ROWS
      return {
        ...s,
        completed: Math.min(LESSONS.length, s.completed + 1),
        beat: joins
          ? { ...s.beat, rows: [...s.beat.rows, newSoundRow(s.sound, 'Lesson sound')] }
          : s.beat,
      }
    })
  }, [])

  const skipToStudio = useCallback(() => setState(s => ({ ...s, studio: true })), [])
  const backToLessons = useCallback(() => setState(s => ({ ...s, studio: false })), [])

  // The beat-maker is the Studio's reward: it appears once the lessons are
  // done or skipped, and always for a shared beat, which is the point of one.
  const gridUnlocked = studio || !!visiting

  const unlocked = useMemo(
    () => (studio || visiting ? new Set(ALL_KNOBS) : unlockedKnobs(state.completed)),
    [studio, visiting, state.completed]
  )
  /** Knobs that arrived with the lesson in progress — they get a moment. */
  const fresh = useMemo(
    () => new Set<KnobId>(lessonIndex !== null ? LESSONS[lessonIndex].unlocks : []),
    [lessonIndex]
  )

  // --- What the knobs edit -------------------------------------------------

  // A row that disappears (removed, or the shared beat was left) drops the
  // knobs back to the lesson sound.
  const targetRow: Row | null =
    chosenTarget === 'sound' ? null : (beat.rows.find(r => r.id === chosenTarget) ?? null)
  const target: Target = targetRow ? targetRow.id : 'sound'
  const patch = targetRow ? targetRow.patch : sound

  const setKnob = useCallback(
    <K extends keyof Patch>(key: K, value: Patch[K]) => {
      setTouched(key)
      if (target === 'sound') updateSound(p => ({ ...p, [key]: value }))
      else
        updateBeat(b => ({
          ...b,
          rows: b.rows.map(r =>
            r.id === target ? { ...r, patch: { ...r.patch, [key]: value } } : r
          ),
        }))
    },
    [target, updateSound, updateBeat]
  )

  // --- Engine -------------------------------------------------------------

  const ensureEngine = useCallback((): Engine | null => {
    const e = unlockEngine()
    if (e && e !== engine) {
      e.setMuted(muted)
      setEngine(e)
    }
    return e
  }, [engine, muted])

  const setMuted = useCallback(
    (m: boolean) => {
      setMutedState(m)
      engine?.setMuted(m)
    },
    [engine]
  )

  // --- Live note (the Play key) -----------------------------------------

  const voice = useRef<Voice | null>(null)
  const freqFor = useCallback(
    (p: Patch) => (targetRow && !targetRow.drum ? rowFreq({ ...targetRow, patch: p }, 0) : p.pitch),
    [targetRow]
  )

  const noteOn = useCallback(() => {
    const e = ensureEngine()
    if (!e || voice.current) return
    const ch = e.channel('live')
    ch.update(patch, e.ctx.currentTime)
    const v = new Voice(e, ch, patch, freqFor(patch))
    v.start(e.ctx.currentTime + 0.005)
    voice.current = v
    setPlaying(true)
  }, [ensureEngine, patch, freqFor])

  const noteOff = useCallback(() => {
    if (!voice.current || !engine) return
    voice.current.stop(engine.ctx.currentTime)
    voice.current = null
    setPlaying(false)
  }, [engine])

  const pressPlay = useCallback(() => {
    if (!hold) noteOn()
  }, [hold, noteOn])

  const releasePlay = useCallback(() => {
    if (!hold) noteOff()
  }, [hold, noteOff])

  const toggleHold = useCallback(() => {
    if (hold) {
      setHold(false)
      noteOff()
    } else {
      setHold(true)
      noteOn()
    }
  }, [hold, noteOn, noteOff])

  // Knob changes reach a sounding note immediately.
  useEffect(() => {
    if (!voice.current || !engine) return
    engine.channel('live').update(patch, engine.ctx.currentTime)
    voice.current.update(patch, freqFor(patch))
  }, [patch, engine, freqFor])

  // --- The beat -------------------------------------------------------------

  const beatRef = useRef(beat)
  useEffect(() => {
    beatRef.current = beat
  }, [beat])
  const seq = useRef<Sequencer | null>(null)

  const toggleBeat = useCallback(() => {
    const e = ensureEngine()
    if (!e) return
    if (!seq.current) {
      seq.current = new Sequencer(
        e.ctx,
        () => stepSeconds(beatRef.current.bpm),
        (s, time) => {
          const b = beatRef.current
          const len = stepSeconds(b.bpm) * 0.92
          for (const row of b.rows) {
            const lane = row.steps[s]
            if (lane === OFF) continue
            playNote(e, e.channel(row.id), row.patch, rowFreq(row, lane), time, len)
          }
        }
      )
    }
    if (seq.current.running) {
      seq.current.stop()
      setBeatOn(false)
    } else {
      seq.current.start()
      setBeatOn(true)
    }
  }, [ensureEngine])

  // The playhead follows what's being heard, not what's been booked.
  useEffect(() => {
    if (!beatOn) return
    let raf = 0
    let last = -2
    const tick = () => {
      const s = seq.current?.audibleStep() ?? -1
      if (s !== last) {
        last = s
        setStep(s)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [beatOn])

  useEffect(() => () => seq.current?.stop(), [])

  const setCell = useCallback(
    (rowId: string, s: number, lane: number) =>
      updateBeat(b => ({
        ...b,
        rows: b.rows.map(r =>
          r.id === rowId ? { ...r, steps: r.steps.map((v, i) => (i === s ? lane : v)) } : r
        ),
      })),
    [updateBeat]
  )

  const setBpm = useCallback((bpm: number) => updateBeat(b => ({ ...b, bpm })), [updateBeat])

  const canAddRow = gridUnlocked && soundRows(beat).length < MAX_SOUND_ROWS

  const setBeatOpen = useCallback((open: boolean) => {
    setBeatOpenState(open)
    try {
      localStorage.setItem(BEAT_OPEN_KEY, open ? '1' : '0')
    } catch {
      // Storage unavailable: it just won't be remembered.
    }
  }, [])

  /** The row just added, so the grid can open its name for editing. */
  const [newRowId, setNewRowId] = useState<string | null>(null)

  const addToBeat = useCallback(
    (p: Patch, name?: string) => {
      if (!canAddRow) return
      const row = newSoundRow(p, name ?? `Sound ${soundRows(beat).length + 1}`)
      updateBeat(b => ({ ...b, rows: [...b.rows, row] }))
      setNewRowId(row.id)
      setBeatOpen(true)
    },
    [beat, canAddRow, updateBeat, setBeatOpen]
  )

  const renameRow = useCallback(
    (rowId: string, name: string) => {
      const clean = name.trim().slice(0, 24)
      if (!clean) return
      updateBeat(b => ({
        ...b,
        rows: b.rows.map(r => (r.id === rowId ? { ...r, name: clean } : r)),
      }))
    },
    [updateBeat]
  )

  // Clear keeps the rows and their sounds, and empties every step. The last
  // pattern is kept for one undo, since a mis-tap would wipe real work.
  const [clearedBeat, setClearedBeat] = useState<Beat | null>(null)

  const clearBeat = useCallback(() => {
    setClearedBeat(beat)
    updateBeat(b => ({ ...b, rows: b.rows.map(r => ({ ...r, steps: r.steps.map(() => OFF) })) }))
  }, [beat, updateBeat])

  const undoClear = useCallback(() => {
    if (!clearedBeat) return
    updateBeat(() => clearedBeat)
    setClearedBeat(null)
  }, [clearedBeat, updateBeat])

  const beatIsEmpty = beat.rows.every(r => r.steps.every(v => v === OFF))

  const removeRow = useCallback(
    (rowId: string) =>
      updateBeat(b => ({ ...b, rows: b.rows.filter(r => r.id !== rowId || r.drum) })),
    [updateBeat]
  )

  // --- Library ------------------------------------------------------------

  const saveSound = useCallback(() => {
    setState(s => {
      if (s.library.length >= LIBRARY_MAX) return s
      const n = s.library.length + 1
      return {
        ...s,
        library: [
          ...s.library,
          {
            id: `lib${Date.now().toString(36)}`,
            name: targetRow?.name ?? `Sound ${n}`,
            patch: { ...patch },
          },
        ],
      }
    })
  }, [patch, targetRow])

  const loadSound = useCallback(
    (p: Patch) => {
      setTarget('sound')
      updateSound(() => ({ ...p }))
    },
    [updateSound]
  )

  const deleteSound = useCallback(
    (id: string) => setState(s => ({ ...s, library: s.library.filter(x => x.id !== id) })),
    []
  )

  // --- Sharing ------------------------------------------------------------

  const shareUrl = useCallback(
    () =>
      `${window.location.origin}${window.location.pathname}#b=${encodeShared({ beat, sound: patch })}`,
    [beat, patch]
  )

  const leaveVisit = useCallback(
    (keep: boolean) => {
      if (keep && visiting) setState(s => ({ ...s, beat: visiting.beat }))
      setVisiting(null)
      history.replaceState(null, '', window.location.pathname)
    },
    [visiting]
  )

  return {
    loaded,
    state,
    visiting,
    beat,
    patch,
    target,
    targetRow,
    setTarget,
    setKnob,
    touched,
    /** Show a knob's hint without changing its value. */
    touch: setTouched,
    unlocked,
    fresh,
    view,
    setView,
    playing,
    hold,
    pressPlay,
    releasePlay,
    toggleHold,
    muted,
    setMuted,
    engine,
    ensureEngine,
    lesson,
    nextLesson,
    skipToStudio,
    backToLessons,
    studio,
    gridUnlocked,
    beatOn,
    toggleBeat,
    step: beatOn ? step : -1,
    setCell,
    setBpm,
    canAddRow,
    addToBeat,
    removeRow,
    renameRow,
    newRowId,
    clearBeat,
    undoClear,
    canUndoClear: clearedBeat !== null && beatIsEmpty,
    beatIsEmpty,
    beatOpen,
    setBeatOpen,
    saveSound,
    loadSound,
    deleteSound,
    shareUrl,
    leaveVisit,
    stepsPerBar: STEPS,
  }
}

export type Hum = ReturnType<typeof useHum>
