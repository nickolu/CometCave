/* ---------------------------------------------------------------------------
   Hum — the sequencer

   The standard look-ahead scheduler: a coarse timer wakes every 25 ms and
   books every step due in the next 120 ms on the AudioContext clock, which
   is sample-accurate. Timing notes off the timer itself drifts audibly,
   because browser timers are late whenever the page is busy drawing.

   `dueSteps` is the whole timing decision, kept pure so it can be tested.
   -------------------------------------------------------------------------- */

import { STEPS } from './beat'

export const LOOKAHEAD_MS = 25
export const SCHEDULE_AHEAD = 0.12

export interface Cursor {
  step: number
  time: number
}

/** Every step whose start falls before `horizon`, and the cursor after them. */
export function dueSteps(
  cursor: Cursor,
  horizon: number,
  stepDur: number
): { due: Cursor[]; next: Cursor } {
  const due: Cursor[] = []
  let { step, time } = cursor
  while (time < horizon) {
    due.push({ step, time })
    time += stepDur
    step = (step + 1) % STEPS
  }
  return { due, next: { step, time } }
}

export class Sequencer {
  private timer: ReturnType<typeof setInterval> | null = null
  private cursor: Cursor = { step: 0, time: 0 }
  /** Steps booked but not yet heard, so the playhead can follow the ear. */
  private readonly booked: Cursor[] = []

  constructor(
    private readonly ctx: AudioContext,
    private readonly stepDur: () => number,
    private readonly onStep: (step: number, time: number) => void
  ) {}

  get running(): boolean {
    return this.timer !== null
  }

  start(): void {
    if (this.timer) return
    this.cursor = { step: 0, time: this.ctx.currentTime + 0.05 }
    this.tick()
    this.timer = setInterval(() => this.tick(), LOOKAHEAD_MS)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.booked.length = 0
  }

  /** The step the listener is hearing right now, or -1 when stopped. */
  audibleStep(): number {
    const now = this.ctx.currentTime
    while (this.booked.length > 1 && this.booked[1].time <= now) this.booked.shift()
    return this.running && this.booked.length && this.booked[0].time <= now
      ? this.booked[0].step
      : -1
  }

  private tick(): void {
    // A tab in the background can sleep through many steps. Skip them
    // rather than firing a burst of stale notes on return.
    const now = this.ctx.currentTime
    if (this.cursor.time < now - 0.2) {
      const behind = Math.ceil((now - this.cursor.time) / this.stepDur())
      this.cursor = {
        step: (this.cursor.step + behind) % STEPS,
        time: this.cursor.time + behind * this.stepDur(),
      }
    }
    const { due, next } = dueSteps(this.cursor, now + SCHEDULE_AHEAD, this.stepDur())
    for (const c of due) {
      this.onStep(c.step, c.time)
      this.booked.push(c)
    }
    this.cursor = next
  }
}
