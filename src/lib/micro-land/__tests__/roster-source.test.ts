import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { sanitizeBlueprint } from '@/app/micro-land/domain/blueprint'
import type { CreatureBlueprint } from '@/app/micro-land/domain/types'
import {
  ROSTER_PATH,
  creatureLiteral,
  printCreatureLiteral,
  renderCreatureLiteral,
  rewriteCreature,
} from '@/lib/micro-land/roster-source'

function blueprint(overrides: Record<string, unknown> = {}): CreatureBlueprint {
  return sanitizeBlueprint({
    name: 'Test Beast',
    blurb: 'A creature for a test.',
    size: 2,
    tags: ['meat', 'beast'],
    art: {
      palette: { a: '#112233', b: '#445566' },
      frames: [['.a.', 'aba', '.a.']],
      frameMs: 200,
      faceMotion: true,
    },
    body: { mass: 1, bounce: 0.1, drag: 0.4, buoyancy: 0.9, immuneTo: [] },
    move: { kind: 'walk', speed: 5, jump: 10, restlessness: 0.3 },
    diet: {
      eats: ['plant'],
      fears: [],
      hungerRate: 0.027,
      starveSeconds: 30,
      breedAt: 0.78,
      lifespanSeconds: 240,
    },
    senses: { sight: 20 },
    habitat: { needs: null, drowns: true },
    dig: { through: [], speed: 1 },
    death: { becomes: null, particleColor: '#ffd166', particleCount: 6 },
    aura: null,
    glow: 0,
    ...overrides,
  })
}

/** The shape of the real file, small enough to read. */
function source(body: string): string {
  return [
    "import { sanitizeBlueprint } from '@/app/micro-land/domain/blueprint'",
    '',
    '// A comment above, which must survive.',
    body,
    '',
    'export const BUILTIN_CREATURES = [SUNLEAF, HOPPER]',
    '',
  ].join('\n')
}

describe('creatureLiteral', () => {
  it('leaves out the fields builtin() supplies', () => {
    const literal = creatureLiteral(blueprint())
    expect(literal).not.toHaveProperty('id')
    expect(literal).not.toHaveProperty('summoned')
  })

  it('keeps the file’s field order rather than the sanitizer’s', () => {
    expect(Object.keys(creatureLiteral(blueprint()))).toEqual([
      'name',
      'blurb',
      'size',
      'tags',
      'art',
      'body',
      'move',
      'diet',
      'senses',
      'habitat',
      'dig',
      'death',
      'aura',
      'glow',
    ])
  })

  it('rounds float noise rather than committing it', () => {
    const bp = blueprint({
      body: { mass: 0.1 + 0.2, bounce: 0.1, drag: 0.4, buoyancy: 0.9, immuneTo: [] },
    })
    const rewritten = rewriteCreature(
      source("const HOPPER = builtin('hopper', {})"),
      'hopper',
      printCreatureLiteral(bp)
    )
    expect(rewritten).toContain('"mass":0.3')
    expect(rewritten).not.toContain('0.30000000000000004')
  })
})

describe('rewriteCreature', () => {
  it('replaces the literal and leaves the file around it alone', () => {
    const before = source("const HOPPER = builtin('hopper', { name: 'Hopper' })")
    const after = rewriteCreature(
      before,
      'hopper',
      printCreatureLiteral(blueprint({ name: 'Bouncer' }))
    ) as string

    expect(after).toContain('// A comment above, which must survive.')
    expect(after).toContain('import { sanitizeBlueprint }')
    expect(after).toContain('export const BUILTIN_CREATURES = [SUNLEAF, HOPPER]')
    expect(after).toContain("const HOPPER = builtin('hopper', {")
    expect(after).toContain('"name":"Bouncer"')
    expect(after).not.toContain("'Hopper'")
  })

  it('finds the end of a literal containing nested objects', () => {
    const before = source(
      "const HOPPER = builtin('hopper', { art: { palette: { a: '#fff' } }, aura: { radius: 3 } })\nconst NEXT = 1"
    )
    const after = rewriteCreature(before, 'hopper', printCreatureLiteral(blueprint())) as string
    expect(after).toContain('const NEXT = 1')
    expect(after).not.toContain('radius: 3')
  })

  it('is not fooled by a brace inside a string', () => {
    const before = source(
      "const HOPPER = builtin('hopper', { blurb: 'it eats { and } for breakfast' })\nconst NEXT = 1"
    )
    const after = rewriteCreature(before, 'hopper', printCreatureLiteral(blueprint())) as string
    expect(after).toContain('const NEXT = 1')
    expect(after).not.toContain('for breakfast')
  })

  it('is not fooled by a brace inside a comment', () => {
    const before = source(
      "const HOPPER = builtin('hopper', {\n  // an unmatched } in a note\n  size: 2,\n})\nconst NEXT = 1"
    )
    const after = rewriteCreature(before, 'hopper', printCreatureLiteral(blueprint())) as string
    expect(after).toContain('const NEXT = 1')
    expect(after).not.toContain('an unmatched')
  })

  it('refuses a creature that is not in the roster rather than appending one', () => {
    const before = source("const HOPPER = builtin('hopper', {})")
    expect(rewriteCreature(before, 'nonesuch', printCreatureLiteral(blueprint()))).toBeNull()
  })

  it('refuses a literal whose braces never close', () => {
    const before = "const HOPPER = builtin('hopper', { size: 2"
    expect(rewriteCreature(before, 'hopper', printCreatureLiteral(blueprint()))).toBeNull()
  })

  it('locates by id, not by the constant name above it', () => {
    const before = source("const SOMETHING_ELSE = builtin('hopper', { size: 2 })")
    const after = rewriteCreature(before, 'hopper', printCreatureLiteral(blueprint())) as string
    expect(after).toContain("const SOMETHING_ELSE = builtin('hopper', {")
  })
})

describe('against the real roster', () => {
  const file = path.join(process.cwd(), ROSTER_PATH)
  const real = readFileSync(file, 'utf8')

  /**
   * The scanner has to survive the file it exists for. The last three carry
   * hand-written comments *inside* their literal, which is both the hardest
   * case for brace matching and the thing the rewrite is documented to wipe.
   */
  it.each(['sunleaf', 'hopper', 'crystal-snail', 'sunhawk', 'drifter-jelly'])(
    'rewrites %s without disturbing the rest of the file',
    id => {
      const after = rewriteCreature(
        real,
        id,
        printCreatureLiteral(blueprint({ name: 'Rewritten' }))
      )
      expect(after).not.toBeNull()

      const text = after as string
      expect(text).toContain('"name":"Rewritten"')
      // The roster's own scaffolding is untouched.
      expect(text).toContain('function builtin(id: string, raw: unknown)')
      expect(text).toContain('export const BUILTIN_CREATURES')
      expect(text).toContain('export const BUILTIN_BY_ID')
      // Every other creature is still declared exactly once.
      const declarations = text.match(/= builtin\(/g) ?? []
      expect(declarations).toHaveLength((real.match(/= builtin\(/g) ?? []).length)
    }
  )

  it('formats the literal in house style', async () => {
    const literal = await renderCreatureLiteral(blueprint({ name: 'Rewritten' }), file)

    expect(literal.startsWith('{')).toBe(true)
    expect(literal.endsWith('}')).toBe(true)
    // Single quotes, unquoted keys, and indented for where it is going: two
    // spaces for its own fields, four for a nested object's.
    expect(literal).toContain("\n  name: 'Rewritten',")
    expect(literal).toContain('\n  art: {')
    expect(literal).toContain('\n    frameMs: 200,')
    expect(literal).not.toContain('"name"')
  })

  /**
   * The reason the literal is formatted alone rather than the file after it.
   *
   * `creatures.ts` is not prettier-clean — creatures added by hand have drifted
   * — so running the formatter over the whole file would rewrite creatures
   * nobody touched and bury the edit. This asserts against the exact drift that
   * caught it: the Emberwing Elder's palette is one long line prettier would
   * split, and it has to survive an edit to a different creature untouched.
   */
  it('leaves every other creature byte-identical', async () => {
    const literal = await renderCreatureLiteral(blueprint({ name: 'Rewritten' }), file)
    const after = rewriteCreature(real, 'sunleaf', literal) as string

    // Everything before the edited literal and after it is the original file.
    const head = real.indexOf("builtin('sunleaf',")
    expect(after.slice(0, head)).toBe(real.slice(0, head))

    const tail = real.indexOf("const BRAMBLE = builtin('bramble',")
    expect(tail).toBeGreaterThan(0)
    expect(after.slice(after.indexOf("const BRAMBLE = builtin('bramble',"))).toBe(real.slice(tail))
  })
})
