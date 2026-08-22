/**
 * The course is data, and the ways it can go quietly wrong are all data
 * problems: a rotation pointing at a week that no longer exists, an id changed
 * in a rename (which silently orphans her progress), or a link that is a
 * search when it was meant to be a lesson.
 */
import { describe, expect, it } from 'vitest'

import { COURSE, type CourseItem, ITEM_IDS, videosFor } from '@/lib/voice-journey/curriculum'

const items: CourseItem[] = COURSE.flatMap(p => p.weeks.flatMap(w => w.items))

describe('course structure', () => {
  it('has 48 steps across 3 phases and 16 weeks', () => {
    expect(COURSE).toHaveLength(3)
    expect(COURSE.flatMap(p => p.weeks)).toHaveLength(16)
    expect(items).toHaveLength(48)
  })

  it('gives every step a unique id', () => {
    expect(new Set(items.map(i => i.id)).size).toBe(items.length)
    expect(ITEM_IDS.size).toBe(items.length)
  })

  it('keeps the ids progress is stored against', () => {
    // Changing one of these orphans whatever she had ticked. If a rename is
    // genuinely wanted, migrate the stored document in the same change.
    for (const week of ['w1', 'w8', 'w16']) {
      for (const suffix of ['a', 'b', 'c']) {
        expect(ITEM_IDS.has(`${week}${suffix}`)).toBe(true)
      }
    }
  })
})

describe('videos', () => {
  it('points every non-search link at a real YouTube watch URL', () => {
    const watches = items.flatMap(videosFor).filter(v => !v.search)
    expect(watches.length).toBeGreaterThan(0)
    for (const video of watches) {
      expect(video.url).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/)
    }
  })

  it('marks every search link as a search', () => {
    for (const video of items.flatMap(videosFor)) {
      const isSearchUrl = video.url.includes('/results?search_query=')
      expect(video.search ?? false).toBe(isSearchUrl)
    }
  })

  it('leaves exactly one step with nothing to watch', () => {
    const empty = items.filter(i => videosFor(i).length === 0)
    expect(empty.map(i => i.id)).toEqual(['w16b'])
  })

  it('labels each video when a step has more than one', () => {
    for (const item of items) {
      const videos = videosFor(item)
      if (videos.length < 2) continue
      expect(videos.every(v => v.label)).toBe(true)
      expect(new Set(videos.map(v => v.label)).size).toBe(videos.length)
    }
  })
})

describe('warm-up rotations', () => {
  const rotating = items.filter(i => i.rotates?.length)

  it('borrows only from steps that exist', () => {
    expect(rotating.length).toBeGreaterThan(0)
    for (const item of rotating) {
      for (const id of item.rotates ?? []) {
        expect(ITEM_IDS.has(id)).toBe(true)
      }
    }
  })

  it('never borrows from another rotation, so resolving stays one level deep', () => {
    const rotatingIds = new Set(rotating.map(i => i.id))
    for (const item of rotating) {
      for (const id of item.rotates ?? []) {
        expect(rotatingIds.has(id)).toBe(false)
      }
    }
  })

  it('resolves to the borrowed videos, named after the week they came from', () => {
    const w5a = items.find(i => i.id === 'w5a')!
    const resolved = videosFor(w5a)
    expect(resolved).toHaveLength(3)
    expect(resolved[0].label).toContain('Cheryl Porter')
  })

  it('expands a borrowed step that itself has two videos', () => {
    // w16a rotates w6a, which is a warm-up paired with a cool-down.
    expect(videosFor(items.find(i => i.id === 'w16a')!)).toHaveLength(2)
  })
})
