import { describe, it, expect } from 'vitest'
import { addCopy, finalForm, evolutionChain, COPIES_TO_EVOLVE } from '../evolution/copies'
import { UNIT_CATALOG } from '../unit-catalog'

describe('addCopy — basic accumulation', () => {
  it('accumulates copies without evolving for fewer than 3', () => {
    let copies: Record<number, number> = {}
    ;({ copies } = addCopy(copies, 1))
    ;({ copies } = addCopy(copies, 1))
    expect(copies[1]).toBe(2)
  })

  it('triggers evolution at exactly 3 copies', () => {
    let copies: Record<number, number> = {}
    let evolutions: Array<{ from: number; to: number }> = []
    ;({ copies, evolutions } = addCopy(copies, 1))
    ;({ copies, evolutions } = addCopy(copies, 1))
    ;({ copies, evolutions } = addCopy(copies, 1))
    expect(evolutions).toHaveLength(1)
    expect(evolutions[0].from).toBe(1)
    // copies[1] should be reduced by 3 and copies[evolvesTo] incremented
    expect((copies[1] ?? 0)).toBe(0)
  })
})

describe('addCopy — Bulbasaur chain (1→2→3)', () => {
  it('evolves Bulbasaur to Ivysaur at 3 copies', () => {
    let copies: Record<number, number> = {}
    let evolutions: Array<{ from: number; to: number }> = []
    for (let i = 0; i < 3; i++) {
      ;({ copies, evolutions } = addCopy(copies, 1))
    }
    expect(evolutions).toHaveLength(1)
    expect(evolutions[0].from).toBe(1)  // Bulbasaur
    // Ivysaur should have 1 copy
    const ivysaurDexId = UNIT_CATALOG.find(u => u.dexId === 1)!.evolvesTo!
    expect(copies[ivysaurDexId]).toBe(1)
  })

  it('chains to Venusaur at 9 copies of Bulbasaur', () => {
    let copies: Record<number, number> = {}
    let allEvolutions: Array<{ from: number; to: number }> = []
    for (let i = 0; i < 9; i++) {
      let evolutions: Array<{ from: number; to: number }> = []
      ;({ copies, evolutions } = addCopy(copies, 1))
      allEvolutions = [...allEvolutions, ...evolutions]
    }
    // Should have evolved to Ivysaur twice (at 3 and 6 copies → 2 Ivysaur)
    // Then at 3 Ivysaur → Venusaur
    const finalDexId = finalForm(1)
    expect(copies[finalDexId]).toBeGreaterThan(0)
  })
})

describe('addCopy — Charmander chain (4→5→6)', () => {
  it('evolves Charmander to Charmeleon at 3 copies', () => {
    let copies: Record<number, number> = {}
    let evolutions: Array<{ from: number; to: number }> = []
    for (let i = 0; i < 3; i++) {
      ;({ copies, evolutions } = addCopy(copies, 4))
    }
    expect(evolutions).toHaveLength(1)
    expect(evolutions[0].from).toBe(4)
  })

  it('reaches Charizard at 9 copies of Charmander', () => {
    let copies: Record<number, number> = {}
    for (let i = 0; i < 9; i++) {
      ;({ copies } = addCopy(copies, 4))
    }
    const finalDexId = finalForm(4)
    expect(copies[finalDexId]).toBeGreaterThan(0)
  })
})

describe('addCopy — Squirtle chain (7→8→9)', () => {
  it('evolves Squirtle to Wartortle at 3 copies', () => {
    let copies: Record<number, number> = {}
    let evolutions: Array<{ from: number; to: number }> = []
    for (let i = 0; i < 3; i++) {
      ;({ copies, evolutions } = addCopy(copies, 7))
    }
    expect(evolutions).toHaveLength(1)
    expect(evolutions[0].from).toBe(7)
  })
})

describe('addCopy — item preservation', () => {
  it('transfers held item through evolution', () => {
    let copies: Record<number, number> = {}
    let items: Record<number, string> = { 1: 'eviolite' }
    let evolutions: Array<{ from: number; to: number }> = []
    for (let i = 0; i < 3; i++) {
      ;({ copies, items, evolutions } = addCopy(copies, 1, items))
    }
    expect(evolutions).toHaveLength(1)
    const evolvedDexId = evolutions[0].to
    expect(items[evolvedDexId]).toBe('eviolite')
    expect(items[1]).toBeUndefined()
  })
})

describe('addCopy — final form does not evolve further', () => {
  it('final forms accumulate copies without evolving', () => {
    const finalDexId = finalForm(1)  // Venusaur
    let copies: Record<number, number> = {}
    let evolutions: Array<{ from: number; to: number }> = []
    for (let i = 0; i < 3; i++) {
      ;({ copies, evolutions } = addCopy(copies, finalDexId))
    }
    // No evolution should trigger (Venusaur has no evolvesTo)
    expect(evolutions).toHaveLength(0)
    expect(copies[finalDexId]).toBe(3)
  })
})

describe('finalForm', () => {
  it('returns the dexId itself for units with no evolution', () => {
    const finalDexId = finalForm(1)
    const finalUnit = UNIT_CATALOG.find(u => u.dexId === finalDexId)!
    expect(finalUnit.evolvesTo).toBeNull()
  })
  it('follows the chain to the end', () => {
    // Bulbasaur (1) should reach Venusaur (3)
    expect(finalForm(1)).toBe(3)
    // Charmander (4) should reach Charizard (6)
    expect(finalForm(4)).toBe(6)
    // Squirtle (7) should reach Blastoise (9)
    expect(finalForm(7)).toBe(9)
  })
})

describe('evolutionChain', () => {
  it('returns single-element array for final forms', () => {
    const finalDexId = finalForm(1)
    expect(evolutionChain(finalDexId)).toEqual([finalDexId])
  })
  it('returns full chain for Bulbasaur', () => {
    expect(evolutionChain(1)).toEqual([1, 2, 3])
  })
  it('returns full chain for Charmander', () => {
    expect(evolutionChain(4)).toEqual([4, 5, 6])
  })
})
