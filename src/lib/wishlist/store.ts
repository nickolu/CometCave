/**
 * A family wish list, published from the Three Kids General Store and kept in
 * Firestore so relatives can see it and mark what they have bought.
 *
 * There is no account behind this. The list id is a long random string that
 * only travels inside the shared link, so the page is private the way an
 * unlisted video is private: anyone holding the link can read it and flip a
 * "bought" mark, nobody else can find it. The write path is correspondingly
 * narrow — a mark names an item the list already holds, carries at most a
 * short free-text name, and nothing else can be stored through the open route.
 *
 * Layout in Firestore (all server-only, see firestore.rules):
 *
 *   wishlists/{listId}                 the list itself: title, shoppers, items
 *   wishlists/{listId}/images/{itemId} one product photo as base64 JPEG
 *   wishlists/{listId}/state/marks     { marks: { "Shopper/itemId": { at, by } } }
 *
 * Publishing rewrites the first two; marks live apart so a republish never
 * forgets what Grandma already bought.
 */
import { FieldValue } from 'firebase-admin/firestore'

import { getFirestoreDb } from '@/lib/firebase/server'

const COLLECTION = 'wishlists'

/** Long enough that a link is the only way to arrive at one. */
export const LIST_ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/
/** Item ids come from the shop: lowercase letters and digits. */
export const ITEM_ID_PATTERN = /^[a-z0-9]{1,40}$/
/** Shopper names are 16 characters or fewer on the shop page. */
const MAX_SHOPPER_LENGTH = 16
/** Whoever marks an item can leave a name so the family knows who to ask. */
export const MAX_BY_LENGTH = 40
/** A base64 JPEG at 480px is around 50 KB; Firestore documents stop at 1 MB. */
const MAX_IMAGE_BASE64 = 900_000
const MAX_TEXT = 600

export interface WishlistItem {
  /** `${shopper}/${itemId}` — one entry per shopper who wants it. */
  key: string
  shopper: string
  id: string
  name: string
  price: number
  /** Free text from the shop card: "8+", "12 oz", "Check listing". */
  age: string
  /** Category name as the shop shows it, e.g. "Build & discover". */
  kind: string
  emoji: string
  blurb: string
  /** A grown-up's free text about the item (size, color, shipping). */
  note?: string
  url: string
  /** The shopper starred it. */
  fav: boolean
  /** A short hash of the photo bytes, present when a photo was published. */
  img?: string
  /** The shop's own order, newest arrivals first. */
  order: number
}

export interface Wishlist {
  id: string
  title: string
  /** The shop slug it came from, for the publisher's bookkeeping. */
  shop: string
  shoppers: string[]
  items: WishlistItem[]
  /** Epoch millis of the publish. */
  publishedAt: number
}

export interface Mark {
  /** Epoch millis. */
  at: number
  /** Who marked it, if they said. */
  by?: string
}

export type Marks = Record<string, Mark>

export interface WishlistView extends Wishlist {
  marks: Marks
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isValidListId(id: unknown): id is string {
  return typeof id === 'string' && LIST_ID_PATTERN.test(id)
}

export function isValidItemId(id: unknown): id is string {
  return typeof id === 'string' && ITEM_ID_PATTERN.test(id)
}

function text(value: unknown, max = MAX_TEXT): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

export function itemKey(shopper: string, id: string): string {
  return `${shopper}/${id}`
}

/**
 * Checks a list on its way into Firestore. The publisher is trusted (it runs
 * with the admin credentials), so this guards against a malformed export, not
 * an attacker: every item must have the fields the page renders, and shoppers
 * and keys must agree.
 */
export function sanitizeWishlist(input: unknown): Wishlist {
  if (!isPlainObject(input)) throw new Error('Wishlist payload must be an object.')
  if (!isValidListId(input.id)) throw new Error('Wishlist id must be 16 to 64 url-safe characters.')
  const title = text(input.title, 80)
  if (!title) throw new Error('Wishlist needs a title.')
  const shop = text(input.shop, 40)
  if (!shop) throw new Error('Wishlist needs the shop slug it came from.')

  const shoppersRaw = Array.isArray(input.shoppers) ? input.shoppers : []
  const shoppers = shoppersRaw
    .map(s => text(s, MAX_SHOPPER_LENGTH))
    .filter((s, i, all) => s && all.indexOf(s) === i)
  if (!shoppers.length) throw new Error('Wishlist needs at least one shopper.')
  const known = new Set(shoppers)

  const itemsRaw = Array.isArray(input.items) ? input.items : []
  const seen = new Set<string>()
  const items: WishlistItem[] = []
  itemsRaw.forEach((raw, order) => {
    if (!isPlainObject(raw)) throw new Error(`Item ${order} is not an object.`)
    const shopper = text(raw.shopper, MAX_SHOPPER_LENGTH)
    if (!known.has(shopper)) throw new Error(`Item ${order} names unknown shopper "${shopper}".`)
    if (!isValidItemId(raw.id)) throw new Error(`Item ${order} has a bad id.`)
    const key = itemKey(shopper, raw.id)
    if (seen.has(key)) throw new Error(`Item ${key} appears twice.`)
    seen.add(key)
    const name = text(raw.name, 200)
    if (!name) throw new Error(`Item ${key} has no name.`)
    const price = typeof raw.price === 'number' && Number.isFinite(raw.price) ? raw.price : NaN
    if (!(price >= 0)) throw new Error(`Item ${key} has no price.`)
    const url = text(raw.url, 2000)
    if (!isHttpsUrl(url)) throw new Error(`Item ${key} needs an https url.`)
    const item: WishlistItem = {
      key,
      shopper,
      id: raw.id,
      name,
      price,
      age: text(raw.age, 40),
      kind: text(raw.kind, 40),
      emoji: text(raw.emoji, 8),
      blurb: text(raw.blurb),
      url,
      fav: raw.fav === true,
      order,
    }
    const note = text(raw.note)
    if (note) item.note = note
    const img = text(raw.img, 16)
    if (/^[a-f0-9]{6,16}$/.test(img)) item.img = img
    items.push(item)
  })

  return {
    id: input.id,
    title,
    shop,
    shoppers,
    items,
    publishedAt: typeof input.publishedAt === 'number' ? input.publishedAt : Date.now(),
  }
}

/** A mark as it comes off the wire: `bought` says which way, `by` is optional. */
export interface MarkRequest {
  key: string
  bought: boolean
  by?: string
}

/**
 * Validates a mark request against the list it targets. Returns an error
 * message fit to show, or the cleaned request.
 */
export function parseMarkRequest(
  body: unknown,
  list: Pick<Wishlist, 'items'>
): { ok: true; mark: MarkRequest } | { ok: false; error: string } {
  if (!isPlainObject(body)) return { ok: false, error: 'Expected a JSON object.' }
  const key = typeof body.key === 'string' ? body.key : ''
  if (!list.items.some(i => i.key === key)) {
    return { ok: false, error: 'That item is not on this list.' }
  }
  if (typeof body.bought !== 'boolean')
    return { ok: false, error: 'Expected bought: true or false.' }
  const by = text(body.by, MAX_BY_LENGTH)
  return { ok: true, mark: by ? { key, bought: body.bought, by } : { key, bought: body.bought } }
}

/** Only known shapes come back out, so a stray field in Firestore cannot reach the page. */
export function sanitizeMarks(input: unknown): Marks {
  const marks: Marks = {}
  if (!isPlainObject(input)) return marks
  for (const [key, raw] of Object.entries(input)) {
    if (!isPlainObject(raw) || typeof raw.at !== 'number') continue
    const by = text(raw.by, MAX_BY_LENGTH)
    marks[key] = by ? { at: raw.at, by } : { at: raw.at }
  }
  return marks
}

/* ---------- Firestore ---------- */

function listRef(id: string) {
  return getFirestoreDb().doc(`${COLLECTION}/${id}`)
}

function marksRef(id: string) {
  return getFirestoreDb().doc(`${COLLECTION}/${id}/state/marks`)
}

function imageRef(id: string, itemId: string) {
  return getFirestoreDb().doc(`${COLLECTION}/${id}/images/${itemId}`)
}

export async function loadWishlist(id: string): Promise<Wishlist | null> {
  const snap = await listRef(id).get()
  if (!snap.exists) return null
  return sanitizeWishlist({ ...snap.data(), id })
}

export async function loadMarks(id: string): Promise<Marks> {
  const snap = await marksRef(id).get()
  return sanitizeMarks(snap.data()?.marks)
}

export async function loadWishlistView(id: string): Promise<WishlistView | null> {
  const [list, marks] = await Promise.all([loadWishlist(id), loadMarks(id)])
  if (!list) return null
  // Marks for items that left the list stay in Firestore (the item may come
  // back) but do not travel to the page.
  const keys = new Set(list.items.map(i => i.key))
  const live: Marks = {}
  for (const [key, mark] of Object.entries(marks)) if (keys.has(key)) live[key] = mark
  return { ...list, marks: live }
}

/**
 * Flips one mark. A `set` with merge touches only this key, so two relatives
 * marking different items at the same moment never overwrite each other.
 */
export async function applyMark(id: string, mark: MarkRequest): Promise<void> {
  const value = mark.bought
    ? { at: Date.now(), ...(mark.by ? { by: mark.by } : {}) }
    : FieldValue.delete()
  await marksRef(id).set({ marks: { [mark.key]: value } }, { merge: true })
}

export interface StoredImage {
  /** Base64 JPEG bytes. */
  data: string
  contentType: string
  /** The same hash the item carries in `img`. */
  hash: string
}

export async function loadImage(id: string, itemId: string): Promise<StoredImage | null> {
  const snap = await imageRef(id, itemId).get()
  const raw = snap.data()
  if (!raw || typeof raw.data !== 'string' || typeof raw.hash !== 'string') return null
  return {
    data: raw.data,
    hash: raw.hash,
    contentType: typeof raw.contentType === 'string' ? raw.contentType : 'image/jpeg',
  }
}

/** Which photos the list already holds, by item id → hash, so a republish only uploads what changed. */
export async function loadImageHashes(id: string): Promise<Record<string, string>> {
  const snap = await getFirestoreDb().collection(`${COLLECTION}/${id}/images`).select('hash').get()
  const hashes: Record<string, string> = {}
  for (const doc of snap.docs) {
    const hash = doc.get('hash')
    if (typeof hash === 'string') hashes[doc.id] = hash
  }
  return hashes
}

export async function saveImage(id: string, itemId: string, image: StoredImage): Promise<void> {
  if (!isValidItemId(itemId)) throw new Error(`Bad item id "${itemId}".`)
  if (image.data.length > MAX_IMAGE_BASE64) throw new Error(`Image for ${itemId} is too large.`)
  await imageRef(id, itemId).set({ ...image, updatedAt: Date.now() })
}

export async function deleteImage(id: string, itemId: string): Promise<void> {
  await imageRef(id, itemId).delete()
}

/** Writes the list document. Marks and images are separate and untouched. */
export async function saveWishlist(list: Wishlist): Promise<void> {
  const { id, ...data } = sanitizeWishlist(list)
  await listRef(id).set(data)
}
