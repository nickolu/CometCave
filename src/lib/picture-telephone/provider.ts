import { createApiProvider } from './api-provider'
import { createMockProvider } from './mock'

import { ProviderError } from './provider-error'

import type { WorkError } from './types'

export { ProviderError }

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

export function toWorkError(err: unknown): WorkError {
  if (err instanceof ProviderError) {
    return { code: err.code, message: err.message, retryable: err.retryable }
  }
  return { code: 'UNKNOWN', message: 'Something went wrong. Try again.', retryable: true }
}

/** True when the client should use sample pictures and canned AI players (local play, tests). */
export function isMockProvider(): boolean {
  // Referenced literally so Next can inline it at build time.
  return process.env.NEXT_PUBLIC_PICTURE_TELEPHONE_MOCK === 'true'
}

export function getProvider(): PictureProvider {
  return isMockProvider() ? createMockProvider() : createApiProvider()
}
