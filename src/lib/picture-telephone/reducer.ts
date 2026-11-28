import { getPersonality } from './personalities'
import { buildSteps, humanSeats, needsHandoff } from './rotation'
import { cleanSentence, validateSettings } from './settings'
import { starterAt } from './starters'

import type { Action, Entry, GameState, Job, Seat, Settings, WorkError } from './types'

/* The whole game as a pure state machine. The store runs the jobs this asks
   for; nothing here awaits anything. */

/** Model rejections of one sentence before a hand-written line takes over. */
export const MAX_AI_REJECTIONS = 2

export const INITIAL_STATE: GameState = {
  phase: 'setup',
  settings: null,
  entries: [],
  stepIndex: 0,
  actorId: null,
  lastHumanId: null,
  job: null,
  error: null,
  notice: null,
  attempts: 0,
}

export const REJECTED_IMAGE_NOTICE = 'That one is too tricky to draw. Try describing something else!'

function seatById(settings: Settings, id: string | null): Seat | undefined {
  return settings.seats.find(s => s.id === id)
}

function lastText(entries: Entry[]): string {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i]
    if (e.kind === 'text') return e.text
  }
  return ''
}

function lastImage(entries: Entry[]): string {
  const last = entries[entries.length - 1]
  return last && last.kind === 'image' ? last.src : ''
}

/** The job an AI seat (or "AI starts") runs for the write step at hand. */
function writeJob(settings: Settings, entries: Entry[], seat: Seat): Job {
  if (entries.length === 0) return { kind: 'starter', seatId: seat.id, input: '' }
  return {
    kind: 'describe',
    seatId: seat.id,
    input: lastImage(entries),
    personalityId: seat.personalityId,
  }
}

/** Work out what the step at `stepIndex` needs and enter the matching phase. */
function enterStep(state: GameState, keepAttempts = false): GameState {
  const settings = state.settings
  if (!settings) return state
  const steps = buildSteps(settings.chainLength, settings.seats.length)
  const step = steps[state.stepIndex]
  const base: GameState = { ...state, job: null, error: null, attempts: keepAttempts ? state.attempts : 0 }
  if (!step) return { ...base, phase: 'reveal', actorId: null }

  if (step.kind === 'image') {
    const actorId = lastTextSeat(state.entries)
    return {
      ...base,
      phase: 'working',
      actorId,
      job: { kind: 'image', seatId: actorId ?? '', input: lastText(state.entries) },
    }
  }

  const seat = settings.seats[step.seatIndex]
  if (seat.kind === 'ai') {
    return { ...base, phase: 'working', actorId: seat.id, job: writeJob(settings, state.entries, seat) }
  }
  const handoff = needsHandoff(state.lastHumanId, seat, humanSeats(settings.seats).length)
  return { ...base, phase: handoff ? 'handoff' : 'turn', actorId: seat.id }
}

function lastTextSeat(entries: Entry[]): string | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i]
    if (e.kind === 'text') return e.seatId
  }
  return null
}

function fallbackText(state: GameState, seat: Seat): string {
  if (state.entries.length === 0) return starterAt(state.stepIndex)
  const lines = getPersonality(seat.personalityId).fallbackLines
  return lines[state.entries.length % lines.length]
}

/** Put a hand-written line into the chain in place of a rejected model sentence. */
function appendFallback(state: GameState, seat: Seat): GameState {
  const entry: Entry = {
    kind: 'text',
    seatId: seat.id,
    text: fallbackText(state, seat),
    viaAi: true,
    fallback: true,
  }
  return enterStep({ ...state, entries: [...state.entries, entry], stepIndex: state.stepIndex + 1 })
}

/** Back up to the write step that produced the last sentence, dropping it. */
function backUpToWrite(state: GameState): GameState {
  return {
    ...state,
    entries: state.entries.slice(0, -1),
    stepIndex: state.stepIndex - 1,
  }
}

function handleReject(state: GameState, error: WorkError): GameState {
  const settings = state.settings
  const job = state.job
  if (!settings || !job) return state
  const seat = seatById(settings, job.seatId)
  if (!seat) return { ...state, error }

  // A model's text was rejected before it reached the chain: ask again, then use a fallback.
  if (job.kind === 'describe' || job.kind === 'starter') {
    if (state.attempts < MAX_AI_REJECTIONS) {
      return { ...state, attempts: state.attempts + 1, job: { ...job }, error: null }
    }
    return appendFallback(state, seat)
  }

  // An image job: the sentence in the chain could not be drawn.
  const last = state.entries[state.entries.length - 1]
  if (!last || last.kind !== 'text') return { ...state, error: { ...error, retryable: true } }

  if (!last.viaAi) {
    // A person wrote it: send them back to try another, without a hand-off.
    const back = backUpToWrite(state)
    return {
      ...back,
      phase: 'turn',
      actorId: last.seatId,
      job: null,
      error: null,
      attempts: 0,
      notice: error.code === 'IMAGE_REJECTED' ? REJECTED_IMAGE_NOTICE : error.message || REJECTED_IMAGE_NOTICE,
    }
  }

  // A model wrote it. Fallback lines are trusted; if one still fails, offer Retry.
  if (last.fallback) return { ...state, error: { ...error, retryable: true } }
  const writer = seatById(settings, last.seatId)
  if (!writer) return { ...state, error: { ...error, retryable: true } }
  if (state.attempts < MAX_AI_REJECTIONS) {
    const back = backUpToWrite(state)
    return {
      ...back,
      phase: 'working',
      attempts: state.attempts + 1,
      error: null,
      job: writeJob(settings, back.entries, writer),
    }
  }
  const back = backUpToWrite(state)
  return appendFallback(back, writer)
}

export function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'START': {
      if (!validateSettings(action.settings).ok) return state
      const settings: Settings = {
        ...action.settings,
        seats: action.settings.seats.map(s => ({ ...s })),
      }
      const first = settings.seats[0]
      return enterStep({
        ...INITIAL_STATE,
        settings,
        lastHumanId: first.kind === 'human' ? first.id : null,
      })
    }

    case 'SUBMIT_TEXT': {
      if (state.phase !== 'turn' || !state.settings) return state
      const text = cleanSentence(action.text)
      if (!text || !state.actorId) return state
      const entry: Entry = { kind: 'text', seatId: state.actorId, text, viaAi: false }
      return enterStep({
        ...state,
        entries: [...state.entries, entry],
        stepIndex: state.stepIndex + 1,
        lastHumanId: state.actorId,
        notice: null,
      })
    }

    case 'REJECT_INPUT': {
      if (state.phase !== 'turn') return state
      return { ...state, notice: action.message }
    }

    case 'AI_STARTS': {
      if (state.phase !== 'turn' || !state.settings || state.entries.length !== 0 || !state.actorId) {
        return state
      }
      return {
        ...state,
        phase: 'working',
        notice: null,
        attempts: 0,
        lastHumanId: state.actorId,
        job: { kind: 'starter', seatId: state.actorId, input: '' },
      }
    }

    case 'WORK_OK': {
      if (state.phase !== 'working' || !state.job || !state.settings) return state
      const job = state.job
      if (job.kind === 'image') {
        if (!('image' in action.result)) return state
        const entry: Entry = { kind: 'image', src: action.result.image, mock: action.result.mock }
        return enterStep({
          ...state,
          entries: [...state.entries, entry],
          stepIndex: state.stepIndex + 1,
        })
      }
      if (!('text' in action.result)) return state
      const text = cleanSentence(action.result.text)
      if (!text) {
        return handleReject(state, { code: 'TEXT_REJECTED', message: '', retryable: true })
      }
      const entry: Entry = { kind: 'text', seatId: job.seatId, text, viaAi: true }
      // The count of rewrites rides along to the picture, so a sentence that
      // keeps failing at the drawing stage still ends on a fallback line.
      return enterStep(
        { ...state, entries: [...state.entries, entry], stepIndex: state.stepIndex + 1 },
        true
      )
    }

    case 'WORK_FAIL': {
      if (state.phase !== 'working' || !state.job) return state
      const { code } = action.error
      if (code === 'TEXT_REJECTED' || code === 'IMAGE_REJECTED') {
        return handleReject(state, action.error)
      }
      return { ...state, error: action.error }
    }

    case 'RETRY': {
      if (state.phase !== 'working' || !state.job || !state.error) return state
      return { ...state, error: null, job: { ...state.job } }
    }

    case 'HANDOFF_READY': {
      if (state.phase !== 'handoff') return state
      return { ...state, phase: 'turn', lastHumanId: state.actorId }
    }

    case 'RESET':
      return INITIAL_STATE
  }
}
