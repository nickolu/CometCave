#!/usr/bin/env tsx
/**
 * Classify each seed in CATEGORIZED_SEEDS by difficulty (easy / medium /
 * hard) using Claude. The result drives difficulty-aware seed selection
 * in generateInfiniteQuestion: easy generations pick from the "iconic /
 * common-knowledge" pool, hard generations pick from the "deep cut /
 * niche" pool.
 *
 * One-shot, idempotent: re-running re-classifies (LLM may change minds
 * between runs, but the file format is stable). Re-run after any seeds.ts
 * edit so new seeds get a difficulty bucket.
 *
 * Output: src/app/trivia/data/seedsByDifficulty.json — shape
 *   { [categoryId]: { easy: string[], medium: string[], hard: string[] } }
 *
 * Usage:
 *   yarn classify-seed-difficulty
 *   (which runs `tsx --env-file=.env.local scripts/classify-seed-difficulty.ts`)
 *
 * Required env vars:
 *   ANTHROPIC_API_KEY
 */

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { createAnthropic } from '@ai-sdk/anthropic'
import { generateObject } from 'ai'
import { z } from 'zod'

import { CATEGORIZED_SEEDS, getOpenTDBCategoryName } from '../src/app/trivia/data/seeds'

// Haiku is plenty for bucketing single words/phrases — Sonnet was
// hanging on long requests. Cost drops ~10x; latency drops more.
const MODEL = 'claude-haiku-4-5-20251001'
const OUTPUT_PATH = resolve(process.cwd(), 'src/app/trivia/data/seedsByDifficulty.json')
// Smaller chunks → faster individual calls, more parallelism opportunity,
// less risk of one stuck call blocking the whole run.
const CHUNK_SIZE = 60

const ResultSchema = z.object({
  easy: z.array(z.string()),
  medium: z.array(z.string()),
  hard: z.array(z.string()),
})

async function classifyCategory(
  apiKey: string,
  categoryName: string,
  seeds: string[]
): Promise<{ easy: string[]; medium: string[]; hard: string[] }> {
  const anthropic = createAnthropic({ apiKey })

  const result = await generateObject({
    model: anthropic(MODEL),
    schema: ResultSchema,
    system:
      'You categorize trivia seeds (topical hints used to vary question generation) by player answerability. Your output drives difficulty-aware seed selection: easy generations sample from the "easy" bucket, hard from the "hard" bucket. Be strict — easy should be the SMALLEST bucket. Recognizing a name is not enough; the casual player has to be able to ANSWER multiple specific trivia questions about it.',
    prompt: `Category: ${categoryName}

Bucket each of the following seeds into easy / medium / hard, judged by what a player would need to answer free-text trivia about the seed.

- easy = a typical adult who has NEVER studied this category could answer 3+ distinct specific trivia questions about this term off the top of their head, with no lookup. Both halves matter:
    1) the term is universally familiar (household name, taught in school, dominant in pop culture), AND
    2) the casual player has internalized enough specific facts about it to actually produce trivia answers — not just recognize the name.
  Examples that PASS easy: "Beatles" (any adult can name songs, members, decades), "Eiffel Tower" (city, country, height ballpark, what era), "World War 2" (sides, key events, dates ballpark).
  Examples that FAIL easy (recognizable names that adults can't answer trivia about): "Cervantes" (most adults: "wrote Don Quixote" — and that's it), "Kurosawa" (most adults: "Japanese director" — and that's it), "Constantine the Great" (most adults: "Roman emperor"), "alkali metals" (most adults: "from the periodic table"). These belong in medium.

- medium = an enthusiast or someone who follows the category casually could answer trivia about it, but a typical adult would struggle past one or two surface facts. (e.g. "color theory" in Art, "concept albums" in Music, "decathlon" in Sports.) ALSO put here: famous-sounding names where adults recognize the name but can't actually answer specific questions about them (Cervantes, Kurosawa, Constantine the Great).

- hard = only a specialist or deep fan would know it well enough to answer trivia about it (e.g. "chiaroscuro" in Art, "modal interchange" in Music, "lutsa" in Sports).

Default toward medium when unsure between easy and medium. Easy should feel narrow — a strict bar produces a more enjoyable easy difficulty for casual players.

Every seed must end up in exactly one bucket. The shape of the response is { easy, medium, hard }, each an array of strings copied verbatim from the input list.

Seeds to classify:
${seeds.map((s) => `- ${s}`).join('\n')}`,
    temperature: 0.2,
    maxTokens: 4000,
  })

  return result.object
}

async function classifyCategoryChunked(
  apiKey: string,
  categoryName: string,
  seeds: string[]
): Promise<{ easy: string[]; medium: string[]; hard: string[] }> {
  const chunks: string[][] = []
  for (let i = 0; i < seeds.length; i += CHUNK_SIZE) {
    chunks.push(seeds.slice(i, i + CHUNK_SIZE))
  }

  const merged: { easy: string[]; medium: string[]; hard: string[] } = {
    easy: [],
    medium: [],
    hard: [],
  }
  // Per-chunk try/retry so one flaky schema-validation failure doesn't
  // drop an entire category (which forces sampling to fall back to the
  // unfiltered pool for that category — we lose all difficulty signal).
  for (let i = 0; i < chunks.length; i++) {
    let part: { easy: string[]; medium: string[]; hard: string[] } | null = null
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        part = await classifyCategory(apiKey, categoryName, chunks[i])
        break
      } catch (err) {
        if (attempt === 2) {
          console.log(
            `  chunk ${i + 1}/${chunks.length} failed after retry: ${err instanceof Error ? err.message : String(err)} — skipping`
          )
        }
      }
    }
    if (!part) continue
    merged.easy.push(...part.easy)
    merged.medium.push(...part.medium)
    merged.hard.push(...part.hard)
  }
  return merged
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('ERROR: ANTHROPIC_API_KEY not set')
    process.exit(1)
  }

  const out: Record<number, { easy: string[]; medium: string[]; hard: string[] }> = {}

  const categoryIds = Object.keys(CATEGORIZED_SEEDS).map(Number).sort((a, b) => a - b)

  for (const id of categoryIds) {
    const name = getOpenTDBCategoryName(id)
    const seeds = CATEGORIZED_SEEDS[id]
    process.stdout.write(`[${id}] ${name} (${seeds.length} seeds)... `)
    const t0 = Date.now()
    try {
      const result = await classifyCategoryChunked(apiKey, name, seeds)
      const total = result.easy.length + result.medium.length + result.hard.length
      const missing = seeds.length - total
      out[id] = result
      console.log(
        `easy=${result.easy.length} medium=${result.medium.length} hard=${result.hard.length}` +
          (missing !== 0 ? ` (warning: ${missing} unaccounted)` : '') +
          ` in ${Date.now() - t0}ms`
      )
    } catch (err) {
      console.log(`FAILED: ${err instanceof Error ? err.message : String(err)}`)
      // Skip on failure rather than crash the whole run; partial output
      // is still useful and the user can re-run for missing categories.
    }
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8')
  console.log(`\nWrote ${Object.keys(out).length} categories → ${OUTPUT_PATH}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
