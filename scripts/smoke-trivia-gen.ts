// One-shot smoke test for the Anthropic trivia generation pipeline.
// Run with: yarn tsx scripts/smoke-trivia-gen.ts
import { readFileSync } from 'node:fs'

async function main() {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1')
  }

  const { generateInfiniteQuestion } = await import('../src/lib/trivia/generateQuestion')

  // Optional CLI args: difficulty=easy|medium|hard category=<id>
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, v] = a.split('=')
      return [k, v]
    })
  )
  const difficulty = (args.difficulty as 'easy' | 'medium' | 'hard') ?? 'medium'
  const categoryId = args.category ? parseInt(args.category, 10) : 9

  const t0 = Date.now()
  const q = await generateInfiniteQuestion({ categoryId, difficulty })
  console.log(`OK in ${Date.now() - t0}ms (category=${categoryId} difficulty=${difficulty})`)
  console.log(JSON.stringify(q, null, 2))
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exit(1)
})
