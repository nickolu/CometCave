#!/usr/bin/env tsx
/**
 * Publish a family wish list to cometcave.com/wishlist/<id>.
 *
 * Takes the payload the Three Kids General Store exports (`npm run wishlist`
 * over there, or `npm run publish` which calls this) and writes it to
 * Firestore with the admin credentials from .env.local: the list document,
 * then every product photo whose bytes changed since the last publish. Bought
 * marks live in their own document and are never touched.
 *
 * Usage:
 *   npm run wishlist:publish -- --payload /path/to/wishlist.json [--images /path/to/img] [--dry-run]
 *
 * The payload is `{ id, title, shop, shoppers, items: [{ shopper, id, name, price, age,
 * kind, emoji, blurb, note?, url, fav, image? }] }` where `image` is a file path
 * relative to --images (or absolute). Everything else is checked by
 * `sanitizeWishlist` in src/lib/wishlist/store.ts.
 *
 * Env (from .env.local via tsx --env-file):
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */
import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import {
  type Wishlist,
  deleteImage,
  isPlainObject,
  loadImageHashes,
  loadWishlist,
  sanitizeWishlist,
  saveImage,
  saveWishlist,
} from '@/lib/wishlist/store'

const SITE = process.env.WISHLIST_SITE ?? 'https://cometcave.com'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1) return undefined
  return process.argv[i + 1]
}
const flag = (name: string) => process.argv.includes(`--${name}`)

const payloadPath = arg('payload')
if (!payloadPath) {
  console.error('Usage: publish-wishlist --payload wishlist.json [--images dir] [--dry-run]')
  process.exit(2)
}
const imagesDir = arg('images') ?? path.dirname(payloadPath)
const dryRun = flag('dry-run')

const raw: unknown = JSON.parse(readFileSync(payloadPath, 'utf8'))
if (!isPlainObject(raw) || !Array.isArray(raw.items)) {
  console.error('Payload must be an object with an items array.')
  process.exit(2)
}

// Read every photo once, hash it, and stamp the hash on each item that uses it
// (two shoppers who like the same thing share one photo).
const photos = new Map<string, { data: string; hash: string }>()
let missing = 0
for (const item of raw.items) {
  if (!isPlainObject(item) || typeof item.id !== 'string') continue
  const rel = typeof item.image === 'string' ? item.image : ''
  if (!rel) continue
  if (!photos.has(item.id)) {
    const file = path.isAbsolute(rel) ? rel : path.join(imagesDir, rel)
    try {
      if (statSync(file).size > 600_000) throw new Error('too large')
      const bytes = readFileSync(file)
      photos.set(item.id, {
        data: bytes.toString('base64'),
        hash: createHash('sha1').update(bytes).digest('hex').slice(0, 10),
      })
    } catch (error) {
      missing++
      console.warn(`  photo missing for ${item.id} (${file}): ${(error as Error).message}`)
    }
  }
  const photo = photos.get(item.id)
  if (photo) item.img = photo.hash
  delete item.image
}

const list: Wishlist = sanitizeWishlist({ ...raw, publishedAt: Date.now() })
const url = `${SITE}/wishlist/${list.id}`

console.log(`${list.title} → ${url}`)
for (const s of list.shoppers) {
  console.log(`  ${s}: ${list.items.filter(i => i.shopper === s).length} items`)
}
console.log(`  ${photos.size} photos${missing ? `, ${missing} missing` : ''}`)

if (dryRun) {
  console.log('Dry run, nothing written.')
  process.exit(0)
}

async function main() {
  const previous = await loadWishlist(list.id)
  const have = await loadImageHashes(list.id)
  let uploaded = 0
  let removed = 0
  for (const [itemId, photo] of photos) {
    if (have[itemId] === photo.hash) continue
    await saveImage(list.id, itemId, {
      data: photo.data,
      hash: photo.hash,
      contentType: 'image/jpeg',
    })
    uploaded++
  }
  for (const itemId of Object.keys(have)) {
    if (photos.has(itemId)) continue
    await deleteImage(list.id, itemId)
    removed++
  }
  await saveWishlist(list)

  console.log(
    `${previous ? 'Updated' : 'Created'} the list. Photos: ${uploaded} uploaded, ${removed} removed, ${photos.size - uploaded} unchanged.`
  )
  console.log(`Share: ${url}`)
}

main().catch(error => {
  console.error('Publish failed:', error)
  process.exit(1)
})
