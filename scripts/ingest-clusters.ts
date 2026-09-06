#!/usr/bin/env tsx
/**
 * Fill the Clusters puzzle bank from the NYT Connections archive.
 *
 * Assignment is SEQUENTIAL and APPEND-ONLY. Each usable source puzzle takes
 * the next play date, starting at 2026-06-12 with the 2023-06-12 puzzle. A
 * source day we cannot run is skipped and never occupies a play date, so
 * the calendar has no holes:
 *
 *   - boards that are not all words (image puzzles, and one mixed board);
 *   - a date the archive will not serve, even after retries.
 *
 * That means the gap between source and play is 1096 days plus however many
 * days have been skipped, and the record of what ran when lives on each
 * document as `source.date` — never recomputed from today's date.
 *
 * The command is idempotent and resumable: it reads the last stored puzzle
 * and appends everything the archive has published since. On an empty bank
 * that is the whole archive, so backfill and the daily top-up are the same
 * command.
 *
 * Usage:
 *   npm run ingest:clusters                     append everything not yet consumed
 *   npm run ingest:clusters -- --dry-run        fetch and parse, write nothing
 *   npm run ingest:clusters -- --limit=200      do it in chunks
 *   npm run ingest:clusters -- --force          rebuild from scratch (pre-launch only)
 *
 * Env (from .env.local via tsx --env-file):
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */

import {
  LAUNCH_DATE,
  SOURCE_EPOCH,
  addDays,
  daysBetween,
  puzzleNumberFor,
  resumeAnchor,
} from '@/lib/clusters/dateMap'
import {
  SOURCE_KIND_REASON,
  SourceParseError,
  classifySource,
  fetchNytPuzzle,
  parseNytPuzzle,
} from '@/lib/clusters/nytSource'
import { getLatestPuzzle, getStoredDates, setPuzzle } from '@/lib/clusters/puzzleDb'
import { getTodayPST } from '@/lib/dates'

const REQUEST_SPACING_MS = 150

interface Options {
  force: boolean
  dryRun: boolean
  limit: number
}

function parseArgs(argv: string[]): Options {
  const opts: Options = { force: false, dryRun: false, limit: Infinity }
  for (const arg of argv) {
    // Accepted and implied: a plain run already appends everything missing.
    if (arg === '--backfill') continue
    else if (arg === '--dry-run') opts.dryRun = true
    else if (arg === '--force') opts.force = true
    else if (arg.startsWith('--limit=')) {
      opts.limit = Number(arg.slice(8))
      if (!Number.isFinite(opts.limit) || opts.limit < 1) {
        throw new Error('--limit must be a positive number')
      }
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown flag: ${arg}`)
    }
  }
  return opts
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Skip {
  sourceDate: string
  reason: string
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const lastSourceDate = getTodayPST()

  const latest = opts.force ? null : await getLatestPuzzle()
  if (latest && !latest.source?.date) {
    throw new Error(
      `Latest puzzle ${latest.date} has no source.date, so the ingest cannot tell ` +
        'how far through the archive it has read. Repair that document before continuing.'
    )
  }

  const anchor = resumeAnchor(
    latest ? { date: latest.date, sourceDate: latest.source!.date } : null
  )

  let playDate = anchor.nextPlayDate
  let sourceDate = anchor.nextSourceDate

  const available = daysBetween(sourceDate, lastSourceDate) + 1
  console.log(
    'Clusters ingest\n' +
      `  anchor        ${LAUNCH_DATE} runs ${SOURCE_EPOCH}\n` +
      `  resuming at   play ${playDate} <- source ${sourceDate}\n` +
      `  source days   ${Math.max(0, available)} up to ${lastSourceDate}\n` +
      (opts.dryRun ? '  DRY RUN       fetching and parsing only, nothing is written\n' : '') +
      (opts.force ? '  FORCE         rebuilding assignment from scratch\n' : '')
  )

  if (available <= 0) {
    console.log('The bank is already current. Nothing to do.')
    return
  }

  let written = 0
  const skipped: Skip[] = []
  const failed: Skip[] = []

  while (daysBetween(sourceDate, lastSourceDate) >= 0 && written < opts.limit) {
    try {
      const raw = await fetchNytPuzzle(sourceDate)
      const kind = classifySource(raw)

      if (kind !== 'words') {
        // Not a board of words. Substituting alt text makes a different
        // puzzle, so it never enters the rotation. Skipping costs nothing:
        // the play date simply goes to the next usable day.
        const reason = SOURCE_KIND_REASON[kind]
        skipped.push({ sourceDate, reason })
        console.log(`  skip ${sourceDate}  ${reason}`)
      } else {
        const parsed = parseNytPuzzle(raw, playDate)
        if (parsed.source.date !== sourceDate) {
          throw new SourceParseError(
            `asked for ${sourceDate} but the archive returned ${parsed.source.date}`
          )
        }
        if (!opts.dryRun) await setPuzzle(parsed)
        written++
        if (written % 100 === 0) {
          console.log(
            `  ${sourceDate} -> ${playDate}  #${puzzleNumberFor(playDate)}   (${written} written)`
          )
        }
        playDate = addDays(playDate, 1)
      }
    } catch (err) {
      // Retries already happened inside fetchNytPuzzle. Whatever is left is
      // a day the archive will not give us, so it is skipped like any other
      // unusable day rather than left as a hole.
      const reason = err instanceof Error ? err.message : String(err)
      failed.push({ sourceDate, reason })
      console.error(`  FAILED ${sourceDate}: ${reason}`)
    }

    sourceDate = addDays(sourceDate, 1)
    await sleep(REQUEST_SPACING_MS)
  }

  const lastAssigned = addDays(playDate, -1)
  console.log(
    `\n${opts.dryRun ? 'Parsed' : 'Wrote'} ${written}. ` +
      `Skipped ${skipped.length}. Failed ${failed.length}.`
  )

  if (skipped.length > 0) {
    console.log('\nSkipped (not run; no play date consumed):')
    for (const s of skipped) console.log(`  ${s.sourceDate}   ${s.reason}`)
  }
  if (failed.length > 0) {
    console.error('\nSource days the archive would not serve, even after retries:')
    for (const f of failed) console.error(`  ${f.sourceDate}   ${f.reason}`)
    console.error('These were skipped, not left as holes. Re-run to pick up any that recover.')
    process.exitCode = 1
  }

  if (opts.dryRun) {
    console.log('\nDry run: nothing was written.')
    return
  }

  // Say what is actually playable, so a run answers the only question that
  // matters: can somebody play today?
  const today = getTodayPST()
  const held = await getStoredDates(LAUNCH_DATE, lastAssigned)
  const live = held.filter((d) => d <= today)
  const needed = Math.max(0, daysBetween(LAUNCH_DATE, today) + 1)
  console.log(
    `\nPlayable now: ${live.length} of ${needed} days (${LAUNCH_DATE} .. ${today})` +
      `\nBank holds ${held.length} puzzles, through ${lastAssigned}.` +
      `\nBuffer: ${Math.max(0, daysBetween(today, lastAssigned))} days of runway.`
  )
  if (live.length < needed) {
    console.error('\nSome playable days have no puzzle. Re-run the ingest.')
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
