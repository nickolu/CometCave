import { createMockProvider } from './mock'

import type { WorkError, WorkErrorCode } from './types'

/** Everything the game needs from "the outside". The model never talks to the network itself. */
export interface PictureProvider {
  /** Draw a sentence. `src` is a data URL; `mock` is true for placeholder art. */
  image(sentence: string): Promise<{ src: string; mock: boolean }>
  /** An AI seat looks at a picture and writes one sentence about it. */
  describe(personalityId: string | undefined, src: string): Promise<{ text: string }>
  /** An AI writes the opening sentence. */
  starter(): Promise<{ text: string }>
  /** Early, friendly check of a human's sentence, before the device is passed on. */
  checkText(text: string): Promise<{ ok: boolean; message?: string }>
}

export class ProviderError extends Error {
  code: WorkErrorCode
  retryable: boolean

  constructor(code: WorkErrorCode, message: string, retryable = false) {
    super(message)
    this.name = 'ProviderError'
    this.code = code
    this.retryable = retryable
  }
}

export function toWorkError(err: unknown): WorkError {
  if (err instanceof ProviderError) {
    return { code: err.code, message: err.message, retryable: err.retryable }
  }
  return { code: 'UNKNOWN', message: 'Something went wrong. Try again.', retryable: true }
}

/** The first playable version always uses the sample-picture provider. */
export function getProvider(): PictureProvider {
  return createMockProvider()
}
