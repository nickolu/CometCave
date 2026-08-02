/**
 * Writing a creature back into the roster's source.
 *
 * The starter roster in `domain/config/creatures.ts` is thirty-four object
 * literals, and the only way to change one has been to hand-edit a wall of
 * five-character strings and guess at the colours. This turns the drawing tool
 * into the editor for them: the builder produces exactly the shape those
 * literals are written in, so an edited creature can be printed straight back
 * over the one it came from.
 *
 * Regenerating the literal wholesale is a deliberate trade. It means every
 * field the builder can reach — pixels, size, diet, how it moves — lands in the
 * file, at the cost of wiping any comment written *inside* the literal being
 * replaced. Three of the thirty-four carry one (the Drifter Jelly's buoyancy
 * note, the Sunhawk's sight note, the Crystal Snail's amphibian note) and they
 * are worth re-adding by hand, which the diff makes impossible to miss.
 *
 * Everything here is pure string work on source text and is deliberately
 * separate from the route that calls it, because the fragile part — finding
 * where one literal ends — is the part worth testing directly.
 */
import prettier from 'prettier'

import type { CreatureBlueprint } from '@/app/micro-land/domain/types'

/** The roster file, relative to the repository root. */
export const ROSTER_PATH = 'src/app/micro-land/domain/config/creatures.ts'

/**
 * The blueprint as the roster writes it.
 *
 * Key order is the file's order rather than the sanitizer's — the two differ
 * around `senses`/`habitat`/`dig`, and the file's order is the one a human
 * reads in a diff.
 *
 * `id` and `summoned` are deliberately absent. Both are `builtin()`'s to
 * supply, and printing an id inside the literal would create a second place
 * where a creature's identity is written down.
 */
export function creatureLiteral(bp: CreatureBlueprint): Record<string, unknown> {
  return {
    name: bp.name,
    blurb: bp.blurb,
    size: bp.size,
    tags: bp.tags,
    art: {
      palette: bp.art.palette,
      frames: bp.art.frames,
      frameMs: bp.art.frameMs,
      faceMotion: bp.art.faceMotion,
    },
    body: {
      mass: bp.body.mass,
      bounce: bp.body.bounce,
      drag: bp.body.drag,
      buoyancy: bp.body.buoyancy,
      immuneTo: bp.body.immuneTo,
    },
    move: {
      kind: bp.move.kind,
      speed: bp.move.speed,
      jump: bp.move.jump,
      restlessness: bp.move.restlessness,
    },
    diet: {
      eats: bp.diet.eats,
      fears: bp.diet.fears,
      hungerRate: bp.diet.hungerRate,
      starveSeconds: bp.diet.starveSeconds,
      breedAt: bp.diet.breedAt,
      lifespanSeconds: bp.diet.lifespanSeconds,
    },
    senses: { sight: bp.senses.sight },
    habitat: { needs: bp.habitat.needs, drowns: bp.habitat.drowns },
    dig: { through: bp.dig.through, speed: bp.dig.speed },
    death: {
      becomes: bp.death.becomes,
      particleColor: bp.death.particleColor,
      particleCount: bp.death.particleCount,
    },
    aura: bp.aura,
    glow: bp.glow,
  }
}

/**
 * Print the literal as source.
 *
 * JSON is a subset of the object syntax TypeScript wants here, so the output
 * only needs to be *valid* — prettier turns it into house style afterwards,
 * unquoting the keys and swapping the quotes using the project's own config.
 * Hand-rolling the formatting instead would mean maintaining a second opinion
 * about how this repo indents.
 *
 * Floats are rounded on the way out. Every number the builder produces has come
 * through a clamp and arithmetic, and a `0.30000000000000004` committed to the
 * roster is noise that survives forever.
 */
export function printCreatureLiteral(bp: CreatureBlueprint): string {
  return JSON.stringify(creatureLiteral(bp), (_key, value) =>
    typeof value === 'number' && !Number.isInteger(value)
      ? Number(value.toFixed(5))
      : (value as unknown)
  )
}

/**
 * The literal as house-style source, formatted on its own.
 *
 * Formatting the whole file after splicing would be one line shorter and was
 * wrong: `creatures.ts` is not prettier-clean today — creatures added by hand
 * have drifted — so every save would sweep unrelated reformatting of other
 * creatures into the diff, and the one thing this tool has to be is a diff you
 * can read.
 *
 * The trick is the wrapper. Prettier needs a whole statement to parse, and
 * `builtin(...)` at the top level is exactly where the literal is going to sit,
 * so what comes back is already indented for its destination. Formatting the
 * bare object instead would produce a correct literal indented for column zero.
 */
export async function renderCreatureLiteral(
  bp: CreatureBlueprint,
  configPath: string
): Promise<string> {
  const options = await prettier.resolveConfig(configPath)
  const wrapped = await prettier.format(`const _ = builtin('x', ${printCreatureLiteral(bp)})`, {
    ...options,
    filepath: configPath,
    parser: 'typescript',
  })

  const open = wrapped.indexOf('{')
  const close = matchBrace(wrapped, open)
  // Prettier just produced this, so both are always found. Falling back to the
  // unformatted literal is still better than writing a truncated one.
  if (open < 0 || close < 0) return printCreatureLiteral(bp)
  return wrapped.slice(open, close + 1)
}

/**
 * Walk forward to the `}` that closes the `{` at `open`.
 *
 * A plain brace counter is wrong here and would stay wrong quietly: a blurb is
 * free-text and a frame row is arbitrary characters, so a single `{` inside a
 * string would throw the count off and the splice would eat the rest of the
 * file. Strings and comments are skipped rather than counted.
 *
 * Returns -1 if the brace never closes, which means the file is not what we
 * think it is and nothing should be written.
 */
function matchBrace(source: string, open: number): number {
  let depth = 0

  for (let i = open; i < source.length; i++) {
    const ch = source[i]

    if (ch === "'" || ch === '"' || ch === '`') {
      i = skipString(source, i)
      if (i < 0) return -1
      continue
    }

    if (ch === '/' && source[i + 1] === '/') {
      const end = source.indexOf('\n', i)
      if (end < 0) return -1
      i = end
      continue
    }

    if (ch === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2)
      if (end < 0) return -1
      i = end + 1
      continue
    }

    if (ch === '{') depth++
    else if (ch === '}' && --depth === 0) return i
  }

  return -1
}

/** Index of the quote that closes the string opening at `start`. -1 if unterminated. */
function skipString(source: string, start: number): number {
  const quote = source[start]
  for (let i = start + 1; i < source.length; i++) {
    if (source[i] === '\\') {
      i++
      continue
    }
    if (source[i] === quote) return i
    // Only template literals are allowed to span lines; anything else running
    // past the end of its line means the scan has lost its place.
    if (source[i] === '\n' && quote !== '`') return -1
  }
  return -1
}

/**
 * Replace one creature's literal in the roster source, leaving the file alone.
 *
 * Located by its `builtin('<id>', {` call rather than by the constant's name,
 * because the id is the thing the game actually knows a creature by — the
 * `const SUNLEAF` above it is just a local handle, and renaming a creature is
 * expected to leave both of them untouched.
 *
 * Returns null when there is no such creature, which the caller should treat as
 * a refusal rather than as permission to append one. This tool edits the roster
 * and does not grow it: a new species also needs a place in the documented food
 * chain at the top of that file and a share of the per-species population caps,
 * neither of which can be inferred from a drawing.
 *
 * Takes the literal as text, already formatted, rather than a blueprint — so
 * that the only edit made to the file is this splice.
 */
export function rewriteCreature(source: string, id: string, literal: string): string | null {
  const call = `builtin('${id}',`
  const at = source.indexOf(call)
  if (at < 0) return null

  const open = source.indexOf('{', at + call.length)
  if (open < 0) return null

  const close = matchBrace(source, open)
  if (close < 0) return null

  return source.slice(0, open) + literal + source.slice(close + 1)
}
