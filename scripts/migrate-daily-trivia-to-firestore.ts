#!/usr/bin/env tsx
/**
 * Bulk-upload daily trivia JSON configs to the dailyQuestions Firestore
 * collection. Reads all JSON files from src/app/trivia/data/questions/,
 * parses them, and writes each as a Firestore document keyed by date.
 *
 * Idempotent — running twice overwrites existing docs (set semantics).
 *
 * Usage:
 *   npm run migrate:daily-trivia
 *
 * Env (loaded from .env.local via tsx --env-file):
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */

import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

import { setDailyQuestions } from '../src/lib/trivia/dailyQuestionsDb'

const DATA_DIR = join(__dirname, '..', 'src', 'app', 'trivia', 'data', 'questions')

async function main() {
  const files = readdirSync(DATA_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()

  console.log(`Found ${files.length} daily trivia JSON files to upload.\n`)

  let uploaded = 0
  let failed = 0
  const failures: string[] = []

  for (const file of files) {
    const filePath = join(DATA_DIR, file)
    try {
      const raw = readFileSync(filePath, 'utf-8')
      const data = JSON.parse(raw) as {
        date: string
        categoryId: number
        categoryName: string
        questions: unknown[]
      }

      await setDailyQuestions(data.date, {
        date: data.date,
        categoryId: data.categoryId,
        categoryName: data.categoryName,
        questions: data.questions as Parameters<typeof setDailyQuestions>[1]['questions'],
      })

      uploaded++
      console.log(`Uploaded ${data.date} (${uploaded}/${files.length})`)
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      failures.push(`${file}: ${msg}`)
      console.error(`FAILED  ${file}: ${msg}`)
    }
  }

  console.log(`\n--- Summary ---`)
  console.log(`Total:    ${files.length}`)
  console.log(`Uploaded: ${uploaded}`)
  console.log(`Failed:   ${failed}`)
  if (failures.length > 0) {
    console.log(`\nFailures:`)
    for (const f of failures) {
      console.log(`  - ${f}`)
    }
  }
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
