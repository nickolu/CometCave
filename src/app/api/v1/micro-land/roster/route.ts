/**
 * Editing the shipped roster, from the game, on the machine that owns the repo.
 *
 * The starter creatures are global assets: every player gets them, and changing
 * one is a change to the source, not to anybody's save file. So this route does
 * the one thing no other route in the app does — it writes a project file — and
 * it only exists while the dev server is running.
 *
 * The gate is `NODE_ENV`, which is the honest one rather than a convenient one.
 * It is fixed at build time, so the route is dead code in the deployed bundle
 * rather than a live endpoint behind a check; there is also no writable checkout
 * on the host to point it at. Nothing here reads a path from the request — the
 * body supplies a creature id used to *find* an existing declaration, and the
 * file being written is a constant.
 *
 * The result still has to be committed by hand. That is the point: an edit made
 * by dragging pixels around lands as a reviewable diff, next to the food chain
 * that roster documents.
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { NextResponse } from 'next/server'

import { sanitizeBlueprint } from '@/app/micro-land/domain/blueprint'
import { ROSTER_PATH, renderCreatureLiteral, rewriteCreature } from '@/lib/micro-land/roster-source'

export const runtime = 'nodejs'

/** In production this route is not a forbidden endpoint — it is not an endpoint. */
const ENABLED = process.env.NODE_ENV === 'development'

export async function POST(request: Request) {
  if (!ENABLED) return new NextResponse(null, { status: 404 })

  let body: { id?: unknown; blueprint?: unknown }
  try {
    body = (await request.json()) as { id?: unknown; blueprint?: unknown }
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  const id = typeof body.id === 'string' ? body.id : ''
  // Built-in ids are slugs by construction. Insisting on that here keeps the
  // value that goes into an `indexOf` from being able to carry regex or quote
  // characters, whatever else changes upstream.
  if (!/^[a-z0-9-]{1,64}$/.test(id)) {
    return NextResponse.json({ error: 'That is not a roster creature id.' }, { status: 400 })
  }

  /**
   * Same sanitizer as every other way into the world, for the same reason.
   *
   * It cannot throw, so this is not validation so much as a guarantee: what
   * gets printed into the roster is exactly what the game would have run, with
   * every clamp already applied. A number the builder let through but the
   * schema does not allow is silently corrected here rather than committed and
   * corrected on every load forever after.
   */
  const blueprint = sanitizeBlueprint(body.blueprint, { idPrefix: 'builtin' })

  const file = path.join(process.cwd(), ROSTER_PATH)

  let source: string
  try {
    source = await readFile(file, 'utf8')
  } catch (error) {
    console.error('micro-land roster read failed:', error)
    return NextResponse.json({ error: 'Could not read the roster file.' }, { status: 500 })
  }

  try {
    // Formatted with the project's own config rather than a guess at it, and
    // formatted *alone* — see `renderCreatureLiteral`. The file this writes to
    // is not prettier-clean, so running the formatter over the whole of it
    // would bury the edited creature in reformatting of every other one.
    const literal = await renderCreatureLiteral(blueprint, file)
    const rewritten = rewriteCreature(source, id, literal)
    if (rewritten === null) {
      return NextResponse.json(
        { error: `No creature called "${id}" in the roster to replace.` },
        { status: 404 }
      )
    }
    await writeFile(file, rewritten, 'utf8')
  } catch (error) {
    console.error('micro-land roster write failed:', error)
    return NextResponse.json({ error: 'Could not write the roster file.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id, name: blueprint.name, file: ROSTER_PATH })
}
