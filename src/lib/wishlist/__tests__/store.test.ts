/**
 * The two checks that stand in for authentication on the open routes: what a
 * publish may store, and what a mark request may change.
 */
import { describe, expect, it } from 'vitest'

import {
  isValidListId,
  itemKey,
  parseMarkRequest,
  sanitizeMarks,
  sanitizeWishlist,
} from '@/lib/wishlist/store'

const LIST_ID = 'abcDEF123456789_-xyz'

function payload(overrides: Record<string, unknown> = {}) {
  return {
    id: LIST_ID,
    title: 'Three Kids General Store',
    shop: 'three-kids',
    shoppers: ['Elliott', 'Cassidy'],
    items: [
      {
        shopper: 'Elliott',
        id: 'lego3',
        name: 'LEGO thing',
        price: 19.99,
        age: '8+',
        kind: 'Build & discover',
        emoji: '🧱',
        blurb: 'Bricks.',
        url: 'https://www.lego.com/x',
        fav: true,
        img: 'a1b2c3d4e5',
      },
      {
        shopper: 'Cassidy',
        id: 'lego3',
        name: 'LEGO thing',
        price: 19.99,
        age: '8+',
        kind: 'Build & discover',
        emoji: '🧱',
        blurb: 'Bricks.',
        url: 'https://www.lego.com/x',
        fav: false,
        note: 'The blue one',
      },
    ],
    ...overrides,
  }
}

describe('isValidListId', () => {
  it('accepts a long url-safe id and rejects short or odd ones', () => {
    expect(isValidListId(LIST_ID)).toBe(true)
    expect(isValidListId('short')).toBe(false)
    expect(isValidListId('has/slash/aaaaaaaaaaaaaaa')).toBe(false)
    expect(isValidListId(42)).toBe(false)
  })
})

describe('sanitizeWishlist', () => {
  it('keeps one entry per shopper for a shared item, keyed by shopper and id', () => {
    const list = sanitizeWishlist(payload())
    expect(list.items.map(i => i.key)).toEqual(['Elliott/lego3', 'Cassidy/lego3'])
    expect(list.items[0].img).toBe('a1b2c3d4e5')
    expect(list.items[0].order).toBe(0)
    expect(list.items[1].note).toBe('The blue one')
    expect(list.items[1].img).toBeUndefined()
  })

  it('refuses an item for a shopper who is not on the list', () => {
    const bad = payload()
    bad.items[0].shopper = 'Stranger'
    expect(() => sanitizeWishlist(bad)).toThrow(/unknown shopper/)
  })

  it('refuses a non-https url and a missing price', () => {
    const noHttps = payload()
    noHttps.items[0].url = 'http://example.com'
    expect(() => sanitizeWishlist(noHttps)).toThrow(/https/)
    const noPrice = payload()
    ;(noPrice.items[0] as Record<string, unknown>).price = 'free'
    expect(() => sanitizeWishlist(noPrice)).toThrow(/price/)
  })

  it('refuses the same shopper and item twice', () => {
    const dup = payload()
    dup.items[1].shopper = 'Elliott'
    expect(() => sanitizeWishlist(dup)).toThrow(/twice/)
  })

  it('drops an image hash that is not a hash', () => {
    const odd = payload()
    odd.items[0].img = '../etc'
    expect(sanitizeWishlist(odd).items[0].img).toBeUndefined()
  })
})

describe('parseMarkRequest', () => {
  const list = sanitizeWishlist(payload())

  it('accepts a mark on a listed item and trims the name', () => {
    const parsed = parseMarkRequest(
      { key: itemKey('Elliott', 'lego3'), bought: true, by: '  Grandma ' },
      list
    )
    expect(parsed).toEqual({
      ok: true,
      mark: { key: 'Elliott/lego3', bought: true, by: 'Grandma' },
    })
  })

  it('leaves the name out when it is empty', () => {
    const parsed = parseMarkRequest({ key: 'Cassidy/lego3', bought: false, by: '' }, list)
    expect(parsed).toEqual({ ok: true, mark: { key: 'Cassidy/lego3', bought: false } })
  })

  it('refuses a key that is not on the list', () => {
    expect(parseMarkRequest({ key: 'Elliott/other', bought: true }, list)).toMatchObject({
      ok: false,
    })
    expect(parseMarkRequest({ key: 'Finley/lego3', bought: true }, list)).toMatchObject({
      ok: false,
    })
  })

  it('refuses a non-boolean bought and a non-object body', () => {
    expect(parseMarkRequest({ key: 'Elliott/lego3', bought: 'yes' }, list)).toMatchObject({
      ok: false,
    })
    expect(parseMarkRequest('Elliott/lego3', list)).toMatchObject({ ok: false })
  })

  it('caps the name', () => {
    const parsed = parseMarkRequest(
      { key: 'Elliott/lego3', bought: true, by: 'x'.repeat(100) },
      list
    )
    expect(parsed.ok && parsed.mark.by?.length).toBe(40)
  })
})

describe('sanitizeMarks', () => {
  it('keeps only marks with a numeric time and a short name', () => {
    expect(
      sanitizeMarks({
        'Elliott/lego3': { at: 1, by: 'Grandma', extra: true },
        'Cassidy/lego3': { at: 'yesterday' },
        junk: 'x',
      })
    ).toEqual({ 'Elliott/lego3': { at: 1, by: 'Grandma' } })
  })
})
