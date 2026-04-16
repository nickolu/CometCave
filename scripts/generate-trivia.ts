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
import { OpenAI } from 'openai'
import { CATEGORIZED_SEEDS, MODIFIERS, getOpenTDBCategoryName } from '../src/app/trivia/data/seeds'
import type { DailyTrivia, TriviaQuestion } from '../src/app/trivia/models/question'

// Resolve the project root (parent of scripts/)
// When bundled with esbuild, import.meta.url points to the bundle file,
// so we use process.cwd() as the base (which should be the project root)
const PROJECT_ROOT = process.cwd()

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function parseArgs(): { days: number; start: string } {
  const args = process.argv.slice(2)
  let days = 30
  let start = getTodayPST()

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days' && args[i + 1]) {
      days = parseInt(args[i + 1], 10)
      i++
    } else if (args[i] === '--start' && args[i + 1]) {
      start = args[i + 1]
      i++
    }
  }

  return { days, start }
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
  openaiClient: OpenAI,
  questionIndex: { current: number }
): Promise<TriviaQuestion | null> {
  const days = daysSinceEpoch(dateStr)
  const seeds = CATEGORIZED_SEEDS[categoryId] ?? CATEGORIZED_SEEDS[9]

  // Pick seed and modifier deterministically using days-based index
  const seedIndex = days % seeds.length
  const modifierIndex = (days * 7 + 13) % MODIFIERS.length
  const seedWord = seeds[seedIndex]
  const modifier = MODIFIERS[modifierIndex]
  const seedStr = `${seedWord} :: ${modifier}`

  console.log(`  Generating AI question with seed: "${seedStr}"`)

  try {
    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are a trivia question creator. Create a hard, specific trivia question with a clear factual answer. Return only valid JSON.',
        },
        {
          role: 'user',
          content: `Generate a hard trivia question about the topic: "${seedStr}"
Category: ${categoryName}
Date: ${dateStr}

The question should:
- Be specific enough that someone knowledgeable could guess the exact answer
- Not mention the answer in the question text
- Have a clear, specific correct answer (a name, date, number, place, or concept)
- Be answerable without multiple choice options

Return JSON in this exact format:
{
  "question": "Your trivia question here?",
  "correct_answer": "The specific correct answer",
  "explanation": "2-3 sentences explaining the answer and why it's interesting."
}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 400,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content
    if (!content) throw new Error('No content in OpenAI response')

    const parsed = JSON.parse(content) as {
      question: string
      correct_answer: string
      explanation: string
    }

    if (!parsed.question || !parsed.correct_answer) {
      throw new Error('Missing required fields in AI response')
    }

    const aiQuestion: TriviaQuestion = {
      id: `ai-${dateStr}-${questionIndex.current}`,
      question: parsed.question,
      options: undefined,
      difficulty: 'hard',
      category: categoryName,
      source: 'ai',
      correctAnswer: parsed.correct_answer,
      explanation: parsed.explanation,
    }
    questionIndex.current++
    console.log(`  AI question generated: "${parsed.question.slice(0, 60)}..."`)
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
  const { days, start } = parseArgs()

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error('ERROR: OPENAI_API_KEY environment variable is not set.')
    process.exit(1)
  }

  const openaiClient = new OpenAI({ apiKey })

  const outputDir = path.join(PROJECT_ROOT, 'src/app/trivia/data/questions')
  fs.mkdirSync(outputDir, { recursive: true })

  console.log(`Generating ${days} days of trivia questions starting from ${start}`)
  console.log(`Output directory: ${outputDir}`)
  console.log('─'.repeat(60))

  const results = {
    generated: 0,
    skipped: 0,
    failed: 0,
  }

  for (let dayOffset = 0; dayOffset < days; dayOffset++) {
    const dateStr = addDays(start, dayOffset)
    const outputFile = path.join(outputDir, `${dateStr}.json`)

    // Skip if file already exists (idempotent)
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

      // Fetch OpenTDB questions (3 easy, 2 medium, 1 hard)
      const opentdbQuestions = await fetchOpenTDBQuestions(dateStr, categoryId, questionIndex)
      console.log(`  OpenTDB: got ${opentdbQuestions.length}/6 questions`)

      // Wait before AI call
      console.log('  Waiting 5.1s before AI question...')
      await new Promise((r) => setTimeout(r, 5100))

      // Generate AI question
      const aiQuestion = await generateAIQuestion(
        dateStr,
        categoryId,
        categoryName,
        openaiClient,
        questionIndex
      )

      // Build questions array
      const allQuestions: TriviaQuestion[] = [...opentdbQuestions]
      if (aiQuestion) allQuestions.push(aiQuestion)

      if (allQuestions.length === 0) {
        console.error(`  ERROR: No questions generated for ${dateStr}`)
        results.failed++
        continue
      }

      // Build DailyTrivia object
      const dailyTrivia: DailyTrivia = {
        date: dateStr,
        categoryId,
        categoryName,
        questions: allQuestions,
      }

      // Write to file
      fs.writeFileSync(outputFile, JSON.stringify(dailyTrivia, null, 2), 'utf-8')
      console.log(`  Wrote ${allQuestions.length} questions to ${path.basename(outputFile)}`)
      results.generated++
    } catch (error) {
      console.error(`  ERROR generating questions for ${dateStr}:`, error)
      results.failed++
    }

    // Brief pause between days to avoid hammering APIs
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
