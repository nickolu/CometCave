import { describe, expect, it } from 'vitest'

import {
  MAX_BLANKS,
  MIN_BLANKS,
  cleanTopic,
  decodeShared,
  encodeShared,
  fillTemplate,
  hintHelp,
  parseTemplate,
  pickTopics,
  sharedFromHash,
  storyText,
} from './story'

const PROSE =
  'Once upon a time there was a very {{adjective}} dragon who lived under the {{a place}}. Every morning it would {{verb}} across the valley, scattering {{plural noun}} everywhere it went. ' +
  'The villagers shouted "{{exclamation}}!" and hid behind their {{plural noun}}. But the dragon only wanted a friend, so it baked a cake out of {{a type of food}}.'

const HINTS = [
  'adjective',
  'a place',
  'verb',
  'plural noun',
  'exclamation',
  'plural noun',
  'a type of food',
]

describe('parseTemplate', () => {
  it('splits a marked-up story into text and blanks in story order', () => {
    const t = parseTemplate({ title: ' The  Dragon ', story: PROSE })
    expect(t).not.toBeNull()
    expect(t!.title).toBe('The Dragon')
    expect(t!.hints).toEqual(HINTS)
    expect(t!.segments.filter(s => s.kind === 'blank')).toHaveLength(7)
    expect(t!.segments[0]).toEqual({
      kind: 'text',
      text: 'Once upon a time there was a very ',
    })
  })

  it('strips a number the model put in front of a hint', () => {
    const story = PROSE.replace('{{adjective}}', '{{1: adjective}}').replace(
      '{{a place}}',
      '{{ 2. a place }}'
    )
    expect(parseTemplate({ title: 't', story })!.hints.slice(0, 2)).toEqual([
      'adjective',
      'a place',
    ])
  })

  it('rejects an empty hint, stray braces or a missing title', () => {
    expect(parseTemplate({ title: 't', story: PROSE.replace('{{verb}}', '{{ }}') })).toBeNull()
    expect(parseTemplate({ title: 't', story: PROSE + ' {oops' })).toBeNull()
    expect(parseTemplate({ title: '  ', story: PROSE })).toBeNull()
  })

  it('rejects the wrong number of blanks', () => {
    expect(MIN_BLANKS).toBeLessThanOrEqual(HINTS.length)
    const few = PROSE.replace('{{a type of food}}', 'jam').replace('{{verb}}', 'fly')
    expect(parseTemplate({ title: 't', story: few })).toBeNull()
    const many =
      PROSE + ' ' + Array.from({ length: MAX_BLANKS }, () => '{{noun}} and so on').join(' ')
    expect(parseTemplate({ title: 't', story: many })).toBeNull()
  })

  it('rejects a story that is almost all blanks', () => {
    const story = HINTS.map(h => `{{${h}}}`).join(' ')
    expect(parseTemplate({ title: 't', story })).toBeNull()
  })
})

describe('fillTemplate and share links', () => {
  const template = parseTemplate({ title: 'Dragon Day', story: PROSE })!
  const words = ['sparkly', 'bathtub', 'wiggle', 'spoons', 'Yikes', 'grandmas', 'crayons ']

  it('fills words in order, trimming them, and marks the ones left empty', () => {
    const story = fillTemplate(template, words.slice(0, 6))
    const filled = story.parts.filter(p => p.kind === 'word')
    expect(filled.map(p => (p.kind === 'word' ? p.word : ''))).toEqual([
      ...words.slice(0, 6),
      '____',
    ])
    expect(storyText(story)).toContain('very sparkly dragon')
    expect(storyText(story).startsWith('Dragon Day\n\n')).toBe(true)
  })

  it('round-trips through a link, including non-ASCII words', () => {
    const story = fillTemplate(template, [...words.slice(0, 6), 'jalapeño 🌶️'])
    const payload = encodeShared(story)
    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decodeShared(payload)).toEqual(story)
    expect(sharedFromHash(`#s=${payload}`)).toEqual(story)
    expect(sharedFromHash(`#x=1&s=${payload}`)).toEqual(story)
  })

  it('refuses links that are not ours', () => {
    expect(decodeShared('')).toBeNull()
    expect(decodeShared('not-base64!')).toBeNull()
    expect(sharedFromHash('#s=')).toBeNull()
    const noWords = Buffer.from(JSON.stringify([1, 'title', ['just text']])).toString('base64url')
    expect(decodeShared(noWords)).toBeNull()
    const wrongVersion = Buffer.from(JSON.stringify([2, 'title', ['a', ['h', 'w']]])).toString(
      'base64url'
    )
    expect(decodeShared(wrongVersion)).toBeNull()
    const longWord = Buffer.from(
      JSON.stringify([1, 'title', ['a', ['h', 'w'.repeat(41)]]])
    ).toString('base64url')
    expect(decodeShared(longWord)).toBeNull()
  })
})

describe('topics and help', () => {
  it('cleans a topic down to one line of bounded length', () => {
    expect(cleanTopic('  a\tdragon\n who   bakes ')).toBe('a dragon who bakes')
    expect(cleanTopic('x'.repeat(200))).toHaveLength(80)
    expect(cleanTopic(42)).toBe('')
  })

  it('picks distinct topic ideas', () => {
    const picks = pickTopics(6, () => 0.5)
    expect(new Set(picks).size).toBe(6)
  })

  it('explains the common grammar hints and stays quiet otherwise', () => {
    expect(hintHelp('Plural noun')).toMatch(/More than one/)
    expect(hintHelp('verb ending in -ing')).toMatch(/-ing/)
    expect(hintHelp('a type of soup')).toBeNull()
  })
})
