#!/usr/bin/env tsx
/**
 * Backfill AI trivia questions into existing daily JSON files.
 * Adds 2 AI questions per day: 1 easy + 1 medium.
 * Idempotent — skips days that already have AI questions.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... npm run backfill-ai-trivia
 */

import fs from 'fs'
import path from 'path'
import { OpenAI } from 'openai'
import { CATEGORIZED_SEEDS, MODIFIERS, getOpenTDBCategoryName } from '../src/app/trivia/data/seeds'
import type { DailyTrivia, TriviaQuestion } from '../src/app/trivia/models/question'

const PROJECT_ROOT = process.cwd()

function daysSinceEpoch(dateStr: string): number {
  const epoch = new Date('1970-01-01T00:00:00Z').getTime()
  const date = new Date(`${dateStr}T00:00:00Z`).getTime()
  return Math.floor((date - epoch) / (1000 * 60 * 60 * 24))
}

async function generateAIQuestion(
  dateStr: string,
  categoryId: number,
  categoryName: string,
  difficulty: 'easy' | 'medium',
  difficultyIndex: number,
  openaiClient: OpenAI,
  questionIndex: number
): Promise<TriviaQuestion | null> {
  const days = daysSinceEpoch(dateStr)
  const seeds = CATEGORIZED_SEEDS[categoryId] ?? CATEGORIZED_SEEDS[9]

  // Different seed/modifier per difficulty so the two AI questions don't overlap
  const seedIndex = (days + difficultyIndex * 17) % seeds.length
  const modifierIndex = (days * 7 + 13 + difficultyIndex * 23) % MODIFIERS.length
  const seedWord = seeds[seedIndex]
  const modifier = MODIFIERS[modifierIndex]
  const seedStr = `${seedWord} :: ${modifier}`

  const difficultyGuidance = difficulty === 'easy'
    ? 'Should be approachable — a well-known fact that many people could answer correctly.'
    : 'Should require some specific knowledge — harder than common knowledge but not obscure trivia.'

  console.log(`  [${difficulty}] Generating AI question with seed: "${seedStr}"`)

  try {
    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are a trivia question creator. Create a specific trivia question with a clear factual answer. Return only valid JSON.',
        },
        {
          role: 'user',
          content: `Generate a ${difficulty} trivia question about the topic: "${seedStr}"
Category: ${categoryName}
Date: ${dateStr}

Difficulty: ${difficulty.toUpperCase()}. ${difficultyGuidance}

The question should:
- Be specific enough that someone knowledgeable could guess the exact answer
- Not mention the answer in the question text
- Have a clear, specific correct answer (a name, date, number, place, or concept — typically 1-3 words)
- Be answerable without multiple choice options
- Be ${difficulty === 'easy' ? 'accessible to a general audience' : 'challenging but fair — require real knowledge of the topic'}

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

    return {
      id: `ai-${dateStr}-${questionIndex}`,
      question: parsed.question,
      options: undefined,
      difficulty,
      category: categoryName,
      source: 'ai',
      correctAnswer: parsed.correct_answer,
      explanation: parsed.explanation,
    }
  } catch (error) {
    console.error(`  [${difficulty}] Failed:`, error)
    return null
  }
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error('ERROR: OPENAI_API_KEY not set')
    process.exit(1)
  }

  const openai = new OpenAI({ apiKey })
  const dir = path.join(PROJECT_ROOT, 'src/app/trivia/data/questions')
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()

  console.log(`Processing ${files.length} files in ${dir}`)
  console.log('─'.repeat(60))

  let updated = 0
  let skipped = 0
  let failed = 0

  for (const file of files) {
    const filePath = path.join(dir, file)
    const raw = fs.readFileSync(filePath, 'utf8')
    const data: DailyTrivia = JSON.parse(raw)

    const existingAI = data.questions.filter(q => q.source === 'ai')
    const hasEasy = existingAI.some(q => q.difficulty === 'easy')
    const hasMedium = existingAI.some(q => q.difficulty === 'medium')

    if (hasEasy && hasMedium) {
      console.log(`[${data.date}] Already has both AI questions — skipping`)
      skipped++
      continue
    }

    console.log(`[${data.date}] category=${data.categoryName}`)
    const newAI: TriviaQuestion[] = []
    let nextIndex = data.questions.length

    if (!hasEasy) {
      const q = await generateAIQuestion(data.date, data.categoryId, data.categoryName, 'easy', 0, openai, nextIndex)
      if (q) {
        newAI.push(q)
        nextIndex++
      } else {
        failed++
      }
    }

    if (!hasMedium) {
      const q = await generateAIQuestion(data.date, data.categoryId, data.categoryName, 'medium', 1, openai, nextIndex)
      if (q) {
        newAI.push(q)
        nextIndex++
      } else {
        failed++
      }
    }

    if (newAI.length > 0) {
      data.questions.push(...newAI)
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
      updated++
      console.log(`  ✓ Added ${newAI.length} AI question(s)`)
    }
  }

  console.log('─'.repeat(60))
  console.log(`Summary: updated=${updated}, skipped=${skipped}, failed=${failed}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
