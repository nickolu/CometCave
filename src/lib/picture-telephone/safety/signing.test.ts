import { describe, expect, it } from 'vitest'

import { getSigningKey, parseImageDataUrl, signImage, verifyImage } from './signing'

const bytes = Buffer.from('pretend these are jpeg bytes')

describe('HMAC signing', () => {
  it('verifies a valid signature', () => {
    const sig = signImage(bytes, 'k1')!
    expect(sig).toMatch(/^[0-9a-f]{64}$/)
    expect(verifyImage(bytes, sig, 'k1')).toBe(true)
  })
  it('rejects tampered bytes', () => {
    const sig = signImage(bytes, 'k1')!
    expect(verifyImage(Buffer.from('pretend these are jpeg byteZ'), sig, 'k1')).toBe(false)
  })
  it('rejects the wrong key', () => {
    expect(verifyImage(bytes, signImage(bytes, 'k1')!, 'k2')).toBe(false)
  })
  it('rejects a missing key, missing signature and malformed signature', () => {
    const sig = signImage(bytes, 'k1')!
    expect(verifyImage(bytes, sig, null)).toBe(false)
    expect(signImage(bytes, null)).toBeNull()
    expect(verifyImage(bytes, undefined, 'k1')).toBe(false)
    expect(verifyImage(bytes, null, 'k1')).toBe(false)
    expect(verifyImage(bytes, 'abc', 'k1')).toBe(false)
    expect(verifyImage(bytes, sig.toUpperCase(), 'k1')).toBe(false)
  })
})

describe('getSigningKey', () => {
  it('uses the env key', () => {
    expect(getSigningKey({ PICTURE_TELEPHONE_SIGNING_KEY: ' abc ', NODE_ENV: 'production' })).toBe('abc')
  })
  it('fails closed outside development and test when unset', () => {
    expect(getSigningKey({ NODE_ENV: 'production' })).toBeNull()
    expect(getSigningKey({ NODE_ENV: 'production', VERCEL_ENV: 'preview' })).toBeNull()
    expect(getSigningKey({})).toBeNull()
    expect(getSigningKey({ PICTURE_TELEPHONE_SIGNING_KEY: '  ', NODE_ENV: 'production' })).toBeNull()
  })
  it('has a dev key in development and test only', () => {
    expect(getSigningKey({ NODE_ENV: 'development' })).toBeTruthy()
    expect(getSigningKey({ NODE_ENV: 'test' })).toBeTruthy()
  })
})

describe('parseImageDataUrl', () => {
  const b64 = bytes.toString('base64')
  it('accepts jpeg, webp and png', () => {
    for (const m of ['jpeg', 'webp', 'png']) expect(parseImageDataUrl(`data:image/${m};base64,${b64}`, 1000)?.bytes).toEqual(bytes)
  })
  it('rejects svg, other schemes, bad base64, oversize and non-strings', () => {
    expect(parseImageDataUrl(`data:image/svg+xml;base64,${b64}`, 1000)).toBeNull()
    expect(parseImageDataUrl(`https://x.test/a.jpg`, 1000)).toBeNull()
    expect(parseImageDataUrl(`data:image/jpeg;base64,${b64}!!`, 1000)).toBeNull()
    expect(parseImageDataUrl(`data:image/jpeg;base64,`, 1000)).toBeNull()
    expect(parseImageDataUrl(`data:image/jpeg;base64,${b64}`, 10)).toBeNull()
    expect(parseImageDataUrl(42, 1000)).toBeNull()
  })
})
