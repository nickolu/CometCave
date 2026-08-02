import { describe, expect, it } from 'vitest'

import { MATERIAL_IDS, MATERIAL_INDEX } from '@/app/micro-land/domain/config/materials'
import { WORLD_H, WORLD_W } from '@/app/micro-land/domain/constants'
import { createWorld } from '@/app/micro-land/domain/sim/world'
import { snapshotWorld } from '@/app/micro-land/worlds/snapshot'
import { WORLD_SAVE_VERSION, type WorldSave } from '@/app/micro-land/worlds/types'
import {
  cleanWorldName,
  isSaveId,
  newSaveId,
  summarize,
  validateWorldSave,
  worldSaveBytes,
} from '@/app/micro-land/worlds/wire'

function aSave(): WorldSave {
  const w = createWorld(99)
  for (let x = 0; x < WORLD_W; x++) w.tiles[(WORLD_H - 1) * WORLD_W + x] = MATERIAL_INDEX.stone
  return {
    version: WORLD_SAVE_VERSION,
    id: 'w-abcdef123456',
    name: 'The Long Shallows',
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_100_000,
    themeId: 'tidepool',
    terrain: null,
    camX: 120,
    land: { landId: 'tidepool', steadySince: 0, elderId: null },
    world: snapshotWorld(w),
  }
}

describe('save ids', () => {
  it('mints ids it will accept back', () => {
    for (let i = 0; i < 20; i++) expect(isSaveId(newSaveId())).toBe(true)
  })

  it('rejects anything that could escape a document path', () => {
    expect(isSaveId('../other')).toBe(false)
    expect(isSaveId('a/b')).toBe(false)
    expect(isSaveId('__proto__')).toBe(false)
    expect(isSaveId('short')).toBe(false)
    expect(isSaveId('w-' + 'a'.repeat(60))).toBe(false)
  })
})

describe('naming a world', () => {
  it('takes what the player typed, tidied', () => {
    expect(cleanWorldName('  the   drowned  cathedral ')).toBe('the drowned cathedral')
  })

  it('falls back rather than refusing an empty name', () => {
    expect(cleanWorldName('   ')).toBe('A world')
    expect(cleanWorldName(undefined, 'Tidepool')).toBe('Tidepool')
  })

  it('caps a name that would not fit on a shelf row', () => {
    expect(cleanWorldName('x'.repeat(200))).toHaveLength(40)
  })
})

describe('validating a save off the wire', () => {
  it('accepts one this game wrote', () => {
    const save = validateWorldSave(aSave())
    expect(save).not.toBeNull()
    expect(save?.name).toBe('The Long Shallows')
    expect(save?.world.creatures).toEqual([])
  })

  it('survives a JSON round trip unchanged where it matters', () => {
    const original = aSave()
    const back = validateWorldSave(JSON.parse(JSON.stringify(original)))
    expect(back?.world.tiles).toEqual(original.world.tiles)
    expect(back?.camX).toBe(120)
  })

  it('refuses a version it does not know', () => {
    expect(validateWorldSave({ ...aSave(), version: 99 })).toBeNull()
  })

  it('refuses an id it would not have minted', () => {
    expect(validateWorldSave({ ...aSave(), id: '../elsewhere' })).toBeNull()
  })

  it('refuses a grid from a world of a different size', () => {
    const save = aSave()
    save.world.width = 100
    expect(validateWorldSave(save)).toBeNull()
  })

  it('refuses runs that do not add up to exactly one world', () => {
    const save = aSave()
    save.world.tiles = [0, 10]
    expect(validateWorldSave(save)).toBeNull()
  })

  it('refuses a material index this build has no material for', () => {
    const save = aSave()
    save.world.tiles = [MATERIAL_IDS.length + 5, WORLD_W * WORLD_H]
    expect(validateWorldSave(save)).toBeNull()
  })

  it('refuses a grid written against a longer material table', () => {
    const save = aSave()
    save.world.materials = MATERIAL_IDS.length + 1
    expect(validateWorldSave(save)).toBeNull()
  })

  it('accepts a grid written against a shorter one, since the table only grows', () => {
    const save = aSave()
    save.world.materials = 4
    expect(validateWorldSave(save)).not.toBeNull()
  })

  it('coerces a creature with nonsense in it rather than dropping the world', () => {
    const save = aSave()
    save.world.creatures = [
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...({ blueprintId: 'hopper', hunger: 'very', x: -50, generation: 0 } as any),
      },
    ]
    const back = validateWorldSave(save)
    expect(back?.world.creatures).toHaveLength(1)
    expect(back?.world.creatures[0].hunger).toBe(0.2)
    expect(back?.world.creatures[0].x).toBe(0)
    expect(back?.world.creatures[0].generation).toBe(1)
  })

  it('drops a creature with no species to point at', () => {
    const save = aSave()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    save.world.creatures = [{ x: 1, y: 1 } as any]
    expect(validateWorldSave(save)?.world.creatures).toEqual([])
  })

  it('never lets a streak claim to have started in the future', () => {
    const save = aSave()
    save.world.elapsed = 60
    save.land.steadySince = 5000
    expect(validateWorldSave(save)?.land.steadySince).toBe(60)
  })

  it('refuses something that is not an object at all', () => {
    expect(validateWorldSave(null)).toBeNull()
    expect(validateWorldSave('a world')).toBeNull()
    expect(validateWorldSave([])).toBeNull()
  })
})

describe('the shelf row', () => {
  it('is derived from the save, so it cannot drift', () => {
    const save = aSave()
    save.world.elapsed = 42
    expect(summarize(save)).toEqual({
      id: 'w-abcdef123456',
      name: 'The Long Shallows',
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_100_000,
      themeId: 'tidepool',
      landName: null,
      creatures: 0,
      elapsed: 42,
    })
  })
})

describe('measuring a save', () => {
  it('counts bytes rather than characters', () => {
    const save = aSave()
    // One character, two bytes — the limit being defended is a byte limit.
    save.name = 'ñ'
    expect(worldSaveBytes(save)).toBe(worldSaveBytes({ ...save, name: 'n' }) + 1)
  })

  it('keeps an empty world well under the storage ceiling', () => {
    // Three screens of terrain run-length encode to almost nothing when empty;
    // this is the floor the real numbers are measured against.
    expect(worldSaveBytes(aSave())).toBeLessThan(5_000)
  })
})
