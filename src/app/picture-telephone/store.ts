import { create } from 'zustand'

import { getPersonality } from '@/lib/picture-telephone/personalities'
import { type PictureProvider, getProvider, toWorkError } from '@/lib/picture-telephone/provider'
import { INITIAL_STATE, gameReducer } from '@/lib/picture-telephone/reducer'

import type { Action, GameState, Job, Settings } from '@/lib/picture-telephone/types'

/* The game lives in memory only: a reload ends it, by design. The reducer
   decides what happens; this store runs the jobs it asks for and feeds the
   answers back. A job is a fresh object per attempt, so "is this still the
   current job?" is an identity check, and a late answer from an abandoned
   game or an old attempt is dropped. */

interface PictureTelephoneStore {
  state: GameState
  dispatch: (action: Action) => void
  start: (settings: Settings) => void
  /** Checks the sentence first, so a human hears "try another" before the device moves on. */
  submit: (text: string) => Promise<void>
}

let provider: PictureProvider | null = null
const getLazyProvider = () => (provider ??= getProvider())

const started = new WeakSet<Job>()

async function runJob(job: Job): Promise<Action> {
  const p = getLazyProvider()
  try {
    if (job.kind === 'image') {
      const { src, mock } = await p.image(job.input)
      return { type: 'WORK_OK', result: { image: src, mock } }
    }
    if (job.kind === 'describe') {
      const personalityId = job.personalityId ?? getPersonality(undefined).id
      const { text } = await p.describe(personalityId, job.input)
      return { type: 'WORK_OK', result: { text } }
    }
    const { text } = await p.starter()
    return { type: 'WORK_OK', result: { text } }
  } catch (err) {
    return { type: 'WORK_FAIL', error: toWorkError(err) }
  }
}

export const usePictureTelephone = create<PictureTelephoneStore>((set, get) => {
  const dispatch = (action: Action) => {
    set(s => ({ state: gameReducer(s.state, action) }))
    const { job, phase } = get().state
    if (phase !== 'working' || !job || started.has(job)) return
    started.add(job)
    void runJob(job).then(result => {
      if (get().state.job === job) dispatch(result)
    })
  }

  return {
    state: INITIAL_STATE,
    dispatch,
    start: settings => dispatch({ type: 'START', settings }),
    submit: async text => {
      const result = await getLazyProvider()
        .checkText(text)
        .catch(() => ({ ok: true as const, message: undefined }))
      if (get().state.phase !== 'turn') return
      if (!result.ok) {
        dispatch({
          type: 'REJECT_INPUT',
          message: result.message ?? 'Try another one. That sentence cannot be drawn.',
        })
        return
      }
      dispatch({ type: 'SUBMIT_TEXT', text })
    },
  }
})
