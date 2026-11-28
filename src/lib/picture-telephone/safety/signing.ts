import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

/* The image route signs what it returns; `describe` only accepts signed
   images. That makes `describe` useless as a general vision API: callers can
   only caption pictures this game generated (and moderated). */

type Env = Record<string, string | undefined>

const DEV_KEY = 'picture-telephone-dev-only-signing-key'

/**
 * The HMAC key, or null when there is none (callers must then refuse). Only
 * development and test get a built-in key; anything else, previews included,
 * needs PICTURE_TELEPHONE_SIGNING_KEY or it fails closed.
 */
export function getSigningKey(env: Env = process.env): string | null {
  const key = env.PICTURE_TELEPHONE_SIGNING_KEY?.trim()
  if (key) return key
  if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') return DEV_KEY
  return null
}

const DATA_URL = /^data:(image\/(?:jpeg|webp|png));base64,([A-Za-z0-9+/]+={0,2})$/

export interface ParsedImage {
  mime: string
  bytes: Buffer
}

/** Strict parse of a jpeg/webp/png data URL. Null for anything else (svg included). */
export function parseImageDataUrl(dataUrl: unknown, maxChars: number): ParsedImage | null {
  if (typeof dataUrl !== 'string' || dataUrl.length > maxChars) return null
  const m = DATA_URL.exec(dataUrl)
  if (!m) return null
  const bytes = Buffer.from(m[2], 'base64')
  return bytes.length > 0 ? { mime: m[1], bytes } : null
}

export function imageDigest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export function signImage(bytes: Uint8Array, key: string | null): string | null {
  if (!key) return null
  return createHmac('sha256', key).update(imageDigest(bytes)).digest('hex')
}

export function verifyImage(bytes: Uint8Array, signature: unknown, key: string | null): boolean {
  if (!key || typeof signature !== 'string' || !/^[0-9a-f]{64}$/.test(signature)) return false
  const expected = signImage(bytes, key)
  if (!expected) return false
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))
}
