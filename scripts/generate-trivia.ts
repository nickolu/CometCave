#!/usr/bin/env tsx
/**
 * Trivia question generator script.
 * Generates N days of trivia questions (6 OpenTDB + 1 AI per day)
 * and writes them as static JSON files to src/app/trivia/data/questions/YYYY-MM-DD.json
 *
 * Usage:
 *   npm run generate-trivia -- --days 30
 *   npm run generate-trivia -- --days 7 --start 2025-01-01
 */

import fs from 'fs'
import path from 'path'
import { getOpenTDBCategoryName } from '../src/app/trivia/data/seeds'
import { generateInfiniteQuestion } from '../src/lib/trivia/generateQuestion'
import type { DailyTrivia, TriviaQuestion } from '../src/app/trivia/models/question'

// Resolve the project root (parent of scripts/)
// When bundled with esbuild, import.meta.url points to the bundle file,
// so we use process.cwd() as the base (which should be the project root)
const PROJECT_ROOT = process.cwd()

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function parseArgs(): { days: number; start: string; regenAiOnly: boolean } {
  const args = process.argv.slice(2)
  let days = 30
  let start = getTodayPST()
  let regenAiOnly = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days' && args[i + 1]) {
      days = parseInt(args[i + 1], 10)
      i++
    } else if (args[i] === '--start' && args[i + 1]) {
      start = args[i + 1]
      i++
    } else if (args[i] === '--regen-ai-only') {
      // Patch existing daily JSON files in place: keep the OpenTDB
      // questions, drop the existing AI question, generate a fresh
      // one via the new pipeline, write back. Useful for refreshing
      // the AI-generated slot after a generation-pipeline change
      // without re-burning OpenTDB rate limit on the MC questions.
      regenAiOnly = true
    }
  }

  return { days, start, regenAiOnly }
}

function getTodayPST(): string {
  const now = new Date()
  // Get the date in PST (UTC-8)
  const pstOffset = -8 * 60
  const pstTime = new Date(now.getTime() + pstOffset * 60 * 1000)
  return pstTime.toISOString().split('T')[0]
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().split('T')[0]
}

function daysSinceEpoch(dateStr: string): number {
  const d = new Date(dateStr + 'T12:00:00Z')
  return Math.floor(d.getTime() / 86400000)
}

// HTML entity decoder
function decodeHTML(html: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
    '&apos;': "'",
    '&eacute;': 'é',
    '&ouml;': 'ö',
    '&uuml;': 'ü',
    '&ntilde;': 'ñ',
    '&rsquo;': "'",
    '&lsquo;': "'",
    '&rdquo;': '"',
    '&ldquo;': '"',
    '&hellip;': '…',
    '&ndash;': '–',
    '&mdash;': '—',
    '&shy;': '',
    '&Eacute;': 'É',
    '&Ouml;': 'Ö',
    '&Uuml;': 'Ü',
    '&aring;': 'å',
    '&Aring;': 'Å',
    '&aelig;': 'æ',
    '&AElig;': 'Æ',
    '&oslash;': 'ø',
    '&Oslash;': 'Ø',
    '&agrave;': 'à',
    '&egrave;': 'è',
    '&igrave;': 'ì',
    '&ograve;': 'ò',
    '&ugrave;': 'ù',
    '&aacute;': 'á',
    '&iacute;': 'í',
    '&oacute;': 'ó',
    '&uacute;': 'ú',
    '&yacute;': 'ý',
    '&ccedil;': 'ç',
    '&Ccedil;': 'Ç',
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™',
    '&deg;': '°',
    '&times;': '×',
    '&divide;': '÷',
    '&laquo;': '«',
    '&raquo;': '»',
    '&frac12;': '½',
    '&frac14;': '¼',
    '&frac34;': '¾',
  }
  return html.replace(/&[#\w]+;/g, (match) => {
    if (entities[match]) return entities[match]
    const decMatch = match.match(/^&#(\d+);$/)
    if (decMatch) return String.fromCharCode(parseInt(decMatch[1], 10))
    const hexMatch = match.match(/^&#x([0-9a-fA-F]+);$/)
    if (hexMatch) return String.fromCharCode(parseInt(hexMatch[1], 16))
    return match
  })
}

// Shuffle array using seeded random
function seededShuffle<T>(array: T[], seed: number): T[] {
  const result = [...array]
  let s = seed
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const j = s % (i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// ────────────────────────────────────────────────────────────────────────────
// OpenTDB fetching
// ────────────────────────────────────────────────────────────────────────────

interface OpenTDBQuestion {
  category: string
  type: string
  difficulty: string
  question: string
  correct_answer: string
  incorrect_answers: string[]
}

interface OpenTDBResponse {
  response_code: number
  results: OpenTDBQuestion[]
}

async function fetchWithRetry(url: string, attempt = 0): Promise<Response> {
  try {
    const res = await fetch(url)
    if (res.status === 429 && attempt < 3) {
      const delay = Math.pow(2, attempt) * 1000
      console.log(`  Rate limited (429). Retrying in ${delay}ms (attempt ${attempt + 1}/3)...`)
      await new Promise((r) => setTimeout(r, delay))
      return fetchWithRetry(url, attempt + 1)
    }
    return res
  } catch (err) {
    if (attempt < 3) {
      const delay = Math.pow(2, attempt) * 1000
      console.log(`  Fetch error. Retrying in ${delay}ms (attempt ${attempt + 1}/3)...`)
      await new Promise((r) => setTimeout(r, delay))
      return fetchWithRetry(url, attempt + 1)
    }
    throw err
  }
}

async function fetchOpenTDBQuestions(
  dateStr: string,
  categoryId: number,
  questionIndex: { current: number }
): Promise<TriviaQuestion[]> {
  const days = daysSinceEpoch(dateStr)

  const difficulties: Array<{ difficulty: string; count: number }> = [
    { difficulty: 'easy', count: 3 },
    { difficulty: 'medium', count: 2 },
    { difficulty: 'hard', count: 1 },
  ]

  const questions: TriviaQuestion[] = []

  for (let idx = 0; idx < difficulties.length; idx++) {
    const { difficulty, count } = difficulties[idx]
    try {
      const url = `https://opentdb.com/api.php?amount=${count}&category=${categoryId}&difficulty=${difficulty}&type=multiple`
      console.log(`  Fetching OpenTDB: category=${categoryId} difficulty=${difficulty} count=${count}`)
      const res = await fetchWithRetry(url)
      const data: OpenTDBResponse = await res.json()

      if (data.response_code === 0 && data.results.length > 0) {
        for (const q of data.results) {
          const seed = days * 1000 + questionIndex.current
          const options = seededShuffle(
            [q.correct_answer, ...q.incorrect_answers].map(decodeHTML),
            seed
          )

          questions.push({
            id: `opentdb-${dateStr}-${questionIndex.current}`,
            question: decodeHTML(q.question),
            options,
            difficulty: difficulty as 'easy' | 'medium' | 'hard',
            category: decodeHTML(q.category),
            source: 'opentdb',
            correctAnswer: decodeHTML(q.correct_answer),
          })
          questionIndex.current++
        }
        console.log(`  Got ${data.results.length} ${difficulty} questions`)
      } else {
        console.warn(`  OpenTDB returned response_code=${data.response_code} for ${difficulty}`)
      }
    } catch (error) {
      console.error(`  Failed to fetch ${difficulty} questions from OpenTDB:`, error)
    }

    // 5-second delay between requests to avoid rate limiting
    if (idx < difficulties.length - 1) {
      console.log('  Waiting 5.1s before next OpenTDB request...')
      await new Promise((r) => setTimeout(r, 5100))
    }
  }

  return questions
}

// ────────────────────────────────────────────────────────────────────────────
// AI question generation
// ────────────────────────────────────────────────────────────────────────────

async function generateAIQuestion(
  dateStr: string,
  categoryId: number,
  categoryName: string,
  questionIndex: { current: number }
): Promise<TriviaQuestion | null> {
  console.log(`  Generating AI question via Infinite pipeline (category=${categoryId} difficulty=hard)`)

  try {
    // Use the same Perplexity-grounded + Claude-construction +
    // numeric-flip + difficulty-aware pipeline as Infinite Trivia.
    // The pipeline picks its own seed + modifier internally (now
    // difficulty-aware via seedsByDifficulty.json).
    const generated = await generateInfiniteQuestion({
      categoryId,
      difficulty: 'hard',
    })

    const aiQuestion: TriviaQuestion = {
      id: `ai-${dateStr}-${questionIndex.current}`,
      question: generated.question,
      options: undefined,
      difficulty: 'hard',
      category: categoryName,
      source: 'ai',
      correctAnswer: generated.correctAnswer,
      explanation: generated.explanation,
    }
    questionIndex.current++
    console.log(`  AI question generated: "${generated.question.slice(0, 60)}..."`)
    return aiQuestion
  } catch (error) {
    console.error('  Failed to generate AI question:', error)
    return null
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Main generator
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  const { days, start, regenAiOnly } = parseArgs()

  // The new pipeline reads PERPLEXITY_API_KEY (preferred) and
  // ANTHROPIC_API_KEY at call time; we sanity-check at least one is
  // set so the script fails fast rather than mid-loop.
  if (!process.env.PERPLEXITY_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    console.error(
      'ERROR: Need PERPLEXITY_API_KEY or ANTHROPIC_API_KEY. Run via `yarn generate-trivia` (which loads .env.local), not raw node.'
    )
    process.exit(1)
  }

  const outputDir = path.join(PROJECT_ROOT, 'src/app/trivia/data/questions')
  fs.mkdirSync(outputDir, { recursive: true })

  if (regenAiOnly) {
    console.log(`Regenerating AI question for ${days} day(s) starting ${start} (preserves OpenTDB questions)`)
  } else {
    console.log(`Generating ${days} days of trivia questions starting from ${start}`)
  }
  console.log(`Output directory: ${outputDir}`)
  console.log('─'.repeat(60))

  const results = { generated: 0, skipped: 0, failed: 0 }

  for (let dayOffset = 0; dayOffset < days; dayOffset++) {
    const dateStr = addDays(start, dayOffset)
    const outputFile = path.join(outputDir, `${dateStr}.json`)

    if (regenAiOnly) {
      // Patch path: file MUST exist; we keep its OpenTDB questions
      // and replace just the AI one. Skip dates that aren't already
      // generated.
      if (!fs.existsSync(outputFile)) {
        console.log(`[${dayOffset + 1}/${days}] ${dateStr} — SKIP (no existing file to patch)`)
        results.skipped++
        continue
      }

      console.log(`[${dayOffset + 1}/${days}] ${dateStr}`)
      try {
        const existing: DailyTrivia = JSON.parse(fs.readFileSync(outputFile, 'utf-8'))
        const opentdbOnly = existing.questions.filter((q) => q.source !== 'ai')
        const questionIndex = { current: opentdbOnly.length }

        const aiQuestion = await generateAIQuestion(
          dateStr,
          existing.categoryId,
          existing.categoryName,
          questionIndex
        )

        if (!aiQuestion) {
          console.error(`  ERROR: AI generation returned null for ${dateStr}`)
          results.failed++
          continue
        }

        const updated: DailyTrivia = {
          ...existing,
          questions: [...opentdbOnly, aiQuestion],
        }
        fs.writeFileSync(outputFile, JSON.stringify(updated, null, 2), 'utf-8')
        console.log(`  Patched AI question in ${path.basename(outputFile)}`)
        results.generated++
      } catch (error) {
        console.error(`  ERROR patching ${dateStr}:`, error)
        results.failed++
      }

      if (dayOffset < days - 1) {
        await new Promise((r) => setTimeout(r, 500))
      }
      continue
    }

    // Standard path: full generation (OpenTDB + AI). Skip dates
    // already generated to keep the script idempotent.
    if (fs.existsSync(outputFile)) {
      console.log(`[${dayOffset + 1}/${days}] ${dateStr} — SKIP (already exists)`)
      results.skipped++
      continue
    }

    console.log(`[${dayOffset + 1}/${days}] ${dateStr}`)

    const daysEpoch = daysSinceEpoch(dateStr)
    const categoryId = 9 + (daysEpoch % 24)
    const categoryName = getOpenTDBCategoryName(categoryId)
    console.log(`  Category: ${categoryName} (ID ${categoryId})`)

    try {
      const questionIndex = { current: 0 }

      const opentdbQuestions = await fetchOpenTDBQuestions(dateStr, categoryId, questionIndex)
      console.log(`  OpenTDB: got ${opentdbQuestions.length}/6 questions`)

      console.log('  Waiting 5.1s before AI question...')
      await new Promise((r) => setTimeout(r, 5100))

      const aiQuestion = await generateAIQuestion(dateStr, categoryId, categoryName, questionIndex)

      const allQuestions: TriviaQuestion[] = [...opentdbQuestions]
      if (aiQuestion) allQuestions.push(aiQuestion)

      if (allQuestions.length === 0) {
        console.error(`  ERROR: No questions generated for ${dateStr}`)
        results.failed++
        continue
      }

      const dailyTrivia: DailyTrivia = {
        date: dateStr,
        categoryId,
        categoryName,
        questions: allQuestions,
      }

      fs.writeFileSync(outputFile, JSON.stringify(dailyTrivia, null, 2), 'utf-8')
      console.log(`  Wrote ${allQuestions.length} questions to ${path.basename(outputFile)}`)
      results.generated++
    } catch (error) {
      console.error(`  ERROR generating questions for ${dateStr}:`, error)
      results.failed++
    }

    if (dayOffset < days - 1) {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  console.log('─'.repeat(60))
  console.log('Summary:')
  console.log(`  Generated: ${results.generated}`)
  console.log(`  Skipped:   ${results.skipped}`)
  console.log(`  Failed:    ${results.failed}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
