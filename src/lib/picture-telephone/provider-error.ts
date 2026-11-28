import type { WorkErrorCode } from './types'

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
