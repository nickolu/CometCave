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
    // Week 6 offers every Phase 1 warm-up back to her, then a cool-down.
    const resolved = videosFor(items.find(i => i.id === 'w6a')!)
    expect(resolved).toHaveLength(6)
    expect(resolved[0].label).toContain('Week 1')
    expect(resolved[3].label).toContain('Week 4')
  })

  it("puts a step's own video after the ones it borrows", () => {
    // The cool-down belongs after the warm-up she picks, not before it.
    for (const id of ['w6a', 'w16a']) {
      const resolved = videosFor(items.find(i => i.id === id)!)
      expect(resolved[resolved.length - 1].label).toContain('Cool-down')
      expect(resolved.slice(0, -1).every(v => v.label?.startsWith('Week'))).toBe(true)
    }
  })

  it('shares one cool-down between the two weeks that end with one', () => {
    const cooldowns = items.flatMap(videosFor).filter(v => v.label?.includes('Cool-down'))
    expect(cooldowns).toHaveLength(2)
    expect(new Set(cooldowns.map(v => v.url)).size).toBe(1)
  })
})

describe('warm-ups are pitched for a beginner', () => {
  const warmupsIn = (phaseId: string) =>
    COURSE.find(p => p.id === phaseId)!.weeks.flatMap(w => w.items.filter(i => i.type === 'warmup'))

  it('keeps the intense Cheryl Porter workout out of Phase 1', () => {
    // It was Weeks 1, 2 and 4 and is too much to start on; it survives as the
    // Week 12 "level up" pick and nowhere earlier.
    const cheryl = '1XHXezdnL0A'
    const phase1 = warmupsIn('p1').flatMap(videosFor)
    expect(phase1.some(v => v.url.includes(cheryl))).toBe(false)

    const w12a = items.find(i => i.id === 'w12a')!
    expect(videosFor(w12a)[0].url).toContain(cheryl)
  })

  it('starts Phase 1 on warm-ups made for young voices', () => {
    const firstTwo = ['w1a', 'w2a'].map(id => items.find(i => i.id === id)!)
    expect(firstTwo.every(i => i.title.includes('Young Voices'))).toBe(true)
    expect(firstTwo.every(i => i.min <= 10)).toBe(true)
  })

  it('rotates the later weeks over the young-voice pair plus the longer Jacobs', () => {
    for (const id of ['w13a', 'w14a', 'w15a', 'w16a']) {
      const item = items.find(i => i.id === id)!
      expect(item.rotates).toEqual(['w1a', 'w2a', 'w7a'])
    }
    expect(videosFor(items.find(i => i.id === 'w7a')!)[0].url).toContain('ck1pzgy07ZU')
  })
})
