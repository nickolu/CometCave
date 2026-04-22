import { describe, expect, it } from 'vitest'

import {
  NPCS,
  RELATIONSHIP_TIERS,
  getRelationshipTier,
  IntentType,
} from '@/app/tap-tap-adventure/config/npcs'

const ALL_INTENT_TYPES: IntentType[] = ['flatter', 'charm', 'threaten', 'inquire', 'offend', 'lie', 'bore', 'neutral']

describe('getRelationshipTier', () => {
  it('returns hostile for disposition -100', () => {
    expect(getRelationshipTier(-100).tier).toBe('hostile')
  })

  it('returns hostile for disposition -31', () => {
    expect(getRelationshipTier(-31).tier).toBe('hostile')
  })

  it('returns unfriendly for disposition -30', () => {
    expect(getRelationshipTier(-30).tier).toBe('unfriendly')
  })

  it('returns neutral for disposition -10', () => {
    expect(getRelationshipTier(-10).tier).toBe('neutral')
  })

  it('returns neutral for disposition 0', () => {
    expect(getRelationshipTier(0).tier).toBe('neutral')
  })

  it('returns friendly for disposition 20', () => {
    expect(getRelationshipTier(20).tier).toBe('friendly')
  })

  it('returns trusted for disposition 50', () => {
    expect(getRelationshipTier(50).tier).toBe('trusted')
  })

  it('returns bonded for disposition 80', () => {
    expect(getRelationshipTier(80).tier).toBe('bonded')
  })

  it('returns bonded for disposition 100', () => {
    expect(getRelationshipTier(100).tier).toBe('bonded')
  })

  it('clamps values above 100 to bonded', () => {
    expect(getRelationshipTier(150).tier).toBe('bonded')
  })

  it('clamps values below -100 to hostile', () => {
    expect(getRelationshipTier(-200).tier).toBe('hostile')
  })
})

describe('RELATIONSHIP_TIERS', () => {
  it('defines all 6 expected tiers', () => {
    const tierNames = RELATIONSHIP_TIERS.map(t => t.tier)
    expect(tierNames).toContain('hostile')
    expect(tierNames).toContain('unfriendly')
    expect(tierNames).toContain('neutral')
    expect(tierNames).toContain('friendly')
    expect(tierNames).toContain('trusted')
    expect(tierNames).toContain('bonded')
    expect(RELATIONSHIP_TIERS).toHaveLength(6)
  })

  it('each tier has min, max, label, and color', () => {
    for (const tier of RELATIONSHIP_TIERS) {
      expect(typeof tier.min).toBe('number')
      expect(typeof tier.max).toBe('number')
      expect(typeof tier.label).toBe('string')
      expect(typeof tier.color).toBe('string')
      expect(tier.label.length).toBeGreaterThan(0)
    }
  })

  it('tiers cover the full range from -100 to 100 with no gaps', () => {
    const sorted = [...RELATIONSHIP_TIERS].sort((a, b) => a.min - b.min)
    expect(sorted[0].min).toBe(-100)
    // Last tier max should be 100
    expect(sorted[sorted.length - 1].max).toBe(100)
    // Each tier's max should equal the next tier's min
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i].max).toBe(sorted[i + 1].min)
    }
  })
})

describe('NPC definitions', () => {
  const expectedNPCIds = [
    'elder_maren',
    'bramble',
    'whisper',
    'grimjaw',
    'crystalline',
    'pyraxis',
    'umbra',
    'seraphiel',
  ]

  it('defines all 8 NPCs', () => {
    const ids = NPCS.map(n => n.id)
    for (const id of expectedNPCIds) {
      expect(ids).toContain(id)
    }
    expect(NPCS).toHaveLength(8)
  })

  it('all 8 NPCs have personalityWeights defined', () => {
    for (const npc of NPCS) {
      expect(npc.personalityWeights).toBeDefined()
      expect(typeof npc.personalityWeights).toBe('object')
    }
  })

  it('all 8 NPCs have at least 1 topic defined', () => {
    for (const npc of NPCS) {
      expect(npc.topics).toBeDefined()
      expect(Array.isArray(npc.topics)).toBe(true)
      expect((npc.topics ?? []).length).toBeGreaterThan(0)
    }
  })

  it('all NPC personalityWeights use valid IntentType keys', () => {
    for (const npc of NPCS) {
      if (!npc.personalityWeights) continue
      for (const key of Object.keys(npc.personalityWeights)) {
        expect(ALL_INTENT_TYPES).toContain(key as IntentType)
      }
    }
  })

  it('each NPC has all 8 intent types covered in personalityWeights', () => {
    for (const npc of NPCS) {
      expect(npc.personalityWeights).toBeDefined()
      const keys = Object.keys(npc.personalityWeights ?? {}) as IntentType[]
      for (const intent of ALL_INTENT_TYPES) {
        expect(keys).toContain(intent)
      }
    }
  })
})

describe('IntentType values', () => {
  it('covers all expected intent types', () => {
    // Verify our ALL_INTENT_TYPES array covers all 8 intended values
    expect(ALL_INTENT_TYPES).toHaveLength(8)
    expect(ALL_INTENT_TYPES).toContain('flatter')
    expect(ALL_INTENT_TYPES).toContain('charm')
    expect(ALL_INTENT_TYPES).toContain('threaten')
    expect(ALL_INTENT_TYPES).toContain('inquire')
    expect(ALL_INTENT_TYPES).toContain('offend')
    expect(ALL_INTENT_TYPES).toContain('lie')
    expect(ALL_INTENT_TYPES).toContain('bore')
    expect(ALL_INTENT_TYPES).toContain('neutral')
  })
})
