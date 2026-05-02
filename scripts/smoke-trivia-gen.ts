// One-shot smoke test for the Anthropic trivia generation pipeline.
// Run with: yarn tsx scripts/smoke-trivia-gen.ts
import { readFileSync } from 'node:fs'

async function main() {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1')
  }

  const { generateInfiniteQuestion } = await import('../src/lib/trivia/generateQuestion')

  const t0 = Date.now()
  const q = await generateInfiniteQuestion({ categoryId: 9, difficulty: 'medium' })
  console.log(`OK in ${Date.now() - t0}ms`)
  console.log(JSON.stringify(q, null, 2))
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exit(1)
})
