import { describe, expect, it } from 'vitest'

import { CARDS, CARDS_BY_ID, CATEGORIES } from './cards'
import { CARD_INFO, CATALOG_URL, CATEGORY_MEANINGS, catalogUrl, tellApart } from './card-info'
import { incidents, newIncidents, seeds } from './incidents'

// Hardcoded from the issue #4042 table. Do not derive this from cards.ts.
const EXPECTED: [string, string][] = [
  ['CF-0001', 'Configuration change affected more than its intended scope'],
  ['CF-0002', 'Software release introduced a production defect'],
  ['CF-0003', 'Planned change had an unanticipated effect'],
  ['CF-0004', 'Data or schema migration altered data running code still used'],
  ['CF-0005', 'Code processed input outside its intended range'],
  ['CF-0006', "Value hit a boundary the code or schema couldn't represent"],
  ['CF-0007', 'Cleanup or deletion removed data or resources in use'],
  ['CF-0026', 'Protective control engaged and its action became the outage'],
  ['CF-0039', 'Written procedure was ambiguous or outdated'],
  ['CF-0008', 'Cached or derived state diverged from its source'],
  ['CF-0009', 'Failover promoted a replica with different state'],
  ['CF-0010', 'Health signal reported healthy while the component failed'],
  ['CF-0037', 'Separate faults appeared as one, or one as several'],
  ['CF-0011', 'Monitoring reported late or reported normal during failure'],
  ['CF-0012', 'Rollback, failover or restart left service degraded'],
  ['CF-0025', 'Recovery took longer or needed more manual work'],
  ['CF-0028', 'Internal dependency failed and propagated'],
  ['CF-0030', 'Network path lost connectivity or capacity'],
  ['CF-0031', 'Name resolution returned wrong or no answers'],
  ['CF-0032', 'Authentication or identity service failed'],
  ['CF-0035', 'Host, disk or other hardware failed'],
  ['CF-0013', 'Automated processes conflicted on shared state'],
  ['CF-0014', 'Scheduling concentrated load on one node or partition'],
  ['CF-0015', 'Demand exceeded provisioned capacity'],
  ['CF-0016', 'Requests queued on a shared resource until it served none'],
  ['CF-0017', 'Hosts exhausted memory'],
  ['CF-0018', 'Expensive or runaway queries saturated a data store'],
  ['CF-0019', 'A provisioned limit was reached'],
  ['CF-0020', 'Demand grew faster than new capacity'],
  ['CF-0021', 'Retries multiplied load on a recovering service'],
  ['CF-0022', 'Cache miss or cold cache sent full load to the backing store'],
  ['CF-0023', 'Bulk or background job competed with serving traffic'],
  ['CF-0024', 'Backlog kept service degraded after the trigger cleared'],
  ['CF-0027', 'Credential or certificate expired while in use'],
  ['CF-0033', 'External provider became unavailable or degraded'],
  ['CF-0034', 'Facility lost power or cooling, or was physically damaged'],
  ['CF-0036', 'External authority or policy restricted the service'],
  ['CF-0038', 'Adversary gained access and acted on the system'],
]

describe('cards', () => {
  it('has the 38 cards from the issue, with exact IDs and official names', () => {
    expect(EXPECTED).toHaveLength(38)
    expect(CARDS.map(c => [c.id, c.officialName]).sort()).toEqual([...EXPECTED].sort())
  })

  it('has no CF-0029 and no duplicate IDs', () => {
    expect(CARDS_BY_ID['CF-0029']).toBeUndefined()
    expect(new Set(CARDS.map(c => c.id)).size).toBe(CARDS.length)
  })

  it('gives every card a nickname and a valid category', () => {
    const cats = new Set(CATEGORIES.map(c => c.id))
    expect(CATEGORIES).toHaveLength(7)
    for (const c of CARDS) {
      expect(c.nickname.trim().length).toBeGreaterThan(0)
      expect(cats.has(c.category)).toBe(true)
    }
  })

  it('puts cards in the categories from the issue', () => {
    const counts: Record<number, number> = {}
    for (const c of CARDS) counts[c.category] = (counts[c.category] ?? 0) + 1
    expect(counts).toEqual({ 1: 9, 2: 4, 3: 1, 4: 7, 5: 2, 6: 11, 7: 4 })
  })
})

describe('incidents', () => {
  it('has 20 incidents: 4 seeds and 16 new', () => {
    expect(seeds).toHaveLength(4)
    expect(newIncidents).toHaveLength(16)
    expect(incidents).toHaveLength(20)
  })

  it('has unique incident IDs', () => {
    expect(new Set(incidents.map(i => i.id)).size).toBe(incidents.length)
  })

  it('makes every card a factor in at least one incident', () => {
    const factors = new Set(incidents.flatMap(i => i.factors))
    const missing = CARDS.map(c => c.id).filter(id => !factors.has(id))
    expect(missing).toEqual([])
  })

  it('has the 16 new incidents cover the 26 cards the seeds do not', () => {
    const seedFactors = new Set(seeds.flatMap(i => i.factors))
    const newFactors = new Set(newIncidents.flatMap(i => i.factors))
    const needed = CARDS.map(c => c.id).filter(id => !seedFactors.has(id))
    expect(needed).toHaveLength(26)
    expect(needed.filter(id => !newFactors.has(id))).toEqual([])
  })

  it.each(incidents.map(i => [i.id, i] as const))('%s is well formed', (_id, inc) => {
    expect(inc.clues).toHaveLength(3)
    for (const clue of inc.clues) expect(clue.trim().length).toBeGreaterThan(0)
    expect(inc.title.trim().length).toBeGreaterThan(0)
    expect(inc.explanation.trim().length).toBeGreaterThan(0)
    expect(inc.background.trim().length).toBeGreaterThan(0)
    expect(inc.factors.length).toBeGreaterThanOrEqual(2)
    expect(inc.factors.length).toBeLessThanOrEqual(3)
    expect(inc.decoys.length).toBeGreaterThanOrEqual(2)
    expect(inc.decoys.length).toBeLessThanOrEqual(3)

    const decoyIds = inc.decoys.map(d => d.id)
    for (const id of [...inc.factors, ...decoyIds]) expect(CARDS_BY_ID[id], `${id} is not a card`).toBeDefined()
    expect(new Set(inc.factors).size).toBe(inc.factors.length)
    expect(new Set(decoyIds).size).toBe(decoyIds.length)
    expect(inc.factors.filter(f => decoyIds.includes(f))).toEqual([])
    for (const d of inc.decoys) expect(d.whyNot.trim().length).toBeGreaterThan(0)
  })
})

describe('incident backgrounds', () => {
  const sentences = (t: string) => t.split(/(?<=[.!?])\s+/).filter(Boolean)

  it.each(incidents.map(i => [i.id, i] as const))('%s has a short plain background that does not name a card', (_id, inc) => {
    expect(sentences(inc.background).length).toBeGreaterThanOrEqual(2)
    expect(sentences(inc.background).length).toBeLessThanOrEqual(3)
    expect(inc.background).not.toMatch(/CF-\d{4}/)
  })

  it('keeps the four seed clues verbatim', () => {
    const friday = seeds.find(i => i.id === 'friday-flag')
    expect(friday?.clues[0]).toBe('14:02 Checkout errors jump in every region at once. No deploy in the last 6 hours.')
    expect(seeds.map(i => i.clues.length)).toEqual([3, 3, 3, 3])
  })
})

describe('card info', () => {
  const words = (t: string) => t.trim().split(/\s+/).length
  const sentenceCount = (t: string) => t.split(/(?<=[.!?])\s+/).filter(Boolean).length

  it('has info for exactly the 38 cards', () => {
    expect(Object.keys(CARD_INFO).sort()).toEqual(CARDS.map(c => c.id).sort())
  })

  it('has a meaning for each of the 7 categories', () => {
    expect(Object.keys(CATEGORY_MEANINGS)).toHaveLength(7)
    for (const c of CATEGORIES) expect(CATEGORY_MEANINGS[c.id].trim().length).toBeGreaterThan(0)
  })

  it.each(CARDS.map(c => [c.id] as const))('%s has every section filled in', id => {
    const info = CARD_INFO[id]
    expect(info.id).toBe(id)
    expect(info.meaning.trim().length).toBeGreaterThan(0)
    expect(sentenceCount(info.meaning)).toBeGreaterThanOrEqual(2)
    expect(sentenceCount(info.meaning)).toBeLessThanOrEqual(3)
    for (const list of [info.situations, info.clues]) {
      expect(list.length).toBeGreaterThanOrEqual(2)
      expect(list.length).toBeLessThanOrEqual(3)
      for (const line of list) {
        expect(line.trim().length).toBeGreaterThan(0)
        expect(words(line), line).toBeLessThanOrEqual(15)
      }
    }
    expect(info.confusedWith.length).toBeGreaterThanOrEqual(2)
    expect(info.confusedWith.length).toBeLessThanOrEqual(3)
  })

  it.each(CARDS.map(c => [c.id] as const))('%s: confusedWith IDs are valid, unique and not itself', id => {
    const ids = CARD_INFO[id].confusedWith.map(c => c.id)
    for (const other of ids) expect(CARDS_BY_ID[other], `${other} is not a card`).toBeDefined()
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).not.toContain(id)
    for (const c of CARD_INFO[id].confusedWith) expect(c.howToTell.trim().length).toBeGreaterThan(0)
  })

  it('links every card to its catalog entry with a lowercase anchor', () => {
    expect(CATALOG_URL).toBe('https://revelara.ai/blog/causal-factor-enumeration/')
    for (const c of CARDS) {
      expect(CARD_INFO[c.id].catalogUrl).toBe(`https://revelara.ai/blog/causal-factor-enumeration/#cf-${c.id.slice(3)}`)
      expect(CARD_INFO[c.id].catalogUrl).toMatch(/#cf-\d{4}$/)
    }
    expect(catalogUrl('CF-0026')).toBe('https://revelara.ai/blog/causal-factor-enumeration/#cf-0026')
  })

  it('uses the decoys the incidents actually use for the cards they sit next to', () => {
    // For each incident, every decoy should list at least one of that incident's factors,
    // or be listed by one of them, so the game and the modal reinforce each other.
    const weak: string[] = []
    for (const inc of incidents) {
      for (const d of inc.decoys) {
        const linked = inc.factors.some(
          f => CARD_INFO[f].confusedWith.some(c => c.id === d.id) || CARD_INFO[d.id].confusedWith.some(c => c.id === f)
        )
        if (!linked) weak.push(`${inc.id}: ${d.id}`)
      }
    }
    // A few decoys are generic distractors (Bad Release, Over Capacity, Noisy Batch Job); allow a small number.
    expect(weak.length, weak.join(', ')).toBeLessThanOrEqual(4)
  })

  it('picks a preferred look-alike for the reveal screen, else the first entry', () => {
    expect(tellApart('CF-0010', ['CF-0037'])?.id).toBe('CF-0037')
    expect(tellApart('CF-0010', [])?.id).toBe('CF-0011')
    expect(tellApart('CF-0010', ['CF-9999'])?.id).toBe('CF-0011')
    expect(tellApart('CF-9999')).toBeUndefined()
  })
})
