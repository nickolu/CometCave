/**
 * Fails when sibling dynamic route segments under the same parent
 * directory use different param names.
 *
 * Next.js requires sibling [name] / [...name] / [[...name]] folders
 * to share a single slug. Mixing them (e.g. [id]/flag alongside
 * [questionId]/reveal) corrupts the App Router manifest at build
 * time and produces deploys where every API function times out
 * with no logs (#1288).
 *
 * Run: `npx tsx scripts/check-route-slugs.ts`
 * Wired into `npm run lint`.
 */
import fs from 'node:fs'
import path from 'node:path'

const APP_DIR = path.join(process.cwd(), 'src/app')

interface Violation {
  parent: string
  slugs: string[]
}

function getDynamicSlugName(folderName: string): string | null {
  // [[...name]] — optional catch-all
  if (/^\[\[\.{3}\w+\]\]$/.test(folderName)) return folderName.slice(5, -2)
  // [...name] — catch-all
  if (/^\[\.{3}\w+\]$/.test(folderName)) return folderName.slice(4, -1)
  // [name] — single dynamic
  if (/^\[\w+\]$/.test(folderName)) return folderName.slice(1, -1)
  return null
}

const violations: Violation[] = []

function walk(dir: string): void {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }

  const slugs = new Set<string>()
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const slug = getDynamicSlugName(entry.name)
    if (slug !== null) slugs.add(slug)
  }

  if (slugs.size > 1) {
    violations.push({
      parent: path.relative(process.cwd(), dir),
      slugs: Array.from(slugs).sort(),
    })
  }

  for (const entry of entries) {
    if (entry.isDirectory()) walk(path.join(dir, entry.name))
  }
}

if (!fs.existsSync(APP_DIR)) {
  console.error(`check-route-slugs: ${APP_DIR} not found`)
  process.exit(1)
}

walk(APP_DIR)

if (violations.length === 0) {
  console.log('check-route-slugs: ok')
  process.exit(0)
}

console.error('check-route-slugs: dynamic-segment slug conflicts found.')
console.error(
  'Sibling [name] / [...name] / [[...name]] folders under the same parent must share a single param name.\n'
)
for (const v of violations) {
  console.error(`  ${v.parent}/`)
  console.error(`    conflicting slugs: ${v.slugs.map((s) => `[${s}]`).join(', ')}`)
}
process.exit(1)
