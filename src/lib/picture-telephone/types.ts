/* Picture Telephone — shared shapes. Pure data: nothing here touches the
   browser or a network, so the game model is testable in node. */

export type SeatKind = 'human' | 'ai'

export interface Seat {
  id: string
  kind: SeatKind
  name: string
  /** Only meaningful for AI seats. Display data lives in personalities.ts. */
  personalityId?: string
}

export interface Settings {
  /** 2-8 seats, at least one human. */
  seats: Seat[]
  /** Number of images in the chain (4-10). A chain has chainLength + 1 sentences. */
  chainLength: number
}

export type Entry =
  | {
      kind: 'text'
      seatId: string
      text: string
      /** True when a model wrote it: an AI seat, "AI starts", or a fallback line. */
      viaAi: boolean
      /** True when the line is a hand-written fallback after the model's text was rejected. */
      fallback?: boolean
    }
  | { kind: 'image'; src: string; mock: boolean }

export type JobKind = 'image' | 'describe' | 'starter'

/** One piece of work for the provider. A new object per attempt (the store keys on identity). */
export interface Job {
  kind: JobKind
  seatId: string
  /** The sentence to draw, or the image to describe. Empty for a starter. */
  input: string
  personalityId?: string
}

export type WorkErrorCode = 'TEXT_REJECTED' | 'IMAGE_REJECTED' | 'UPSTREAM' | 'UNKNOWN'

export interface WorkError {
  code: WorkErrorCode
  message: string
  retryable: boolean
}

export type Phase = 'setup' | 'handoff' | 'turn' | 'working' | 'reveal'

export interface GameState {
  phase: Phase
  settings: Settings | null
  entries: Entry[]
  /** Index into buildSteps(). */
  stepIndex: number
  /** The seat whose move it is (handoff, turn), or who the working job belongs to. */
  actorId: string | null
  /** The last human seat to hold the device. */
  lastHumanId: string | null
  job: Job | null
  error: WorkError | null
  /** A friendly banner for the turn screen ("try another one"). */
  notice: string | null
  /** Rejections of the current write step by a model. */
  attempts: number
}

export type WorkResult = { image: string; mock: boolean } | { text: string }

export type Action =
  | { type: 'START'; settings: Settings }
  | { type: 'SUBMIT_TEXT'; text: string }
  | { type: 'REJECT_INPUT'; message: string }
  | { type: 'AI_STARTS' }
  | { type: 'WORK_OK'; result: WorkResult }
  | { type: 'WORK_FAIL'; error: WorkError }
  | { type: 'RETRY' }
  | { type: 'HANDOFF_READY' }
  | { type: 'RESET' }
