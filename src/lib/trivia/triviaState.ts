import { FieldValue } from 'firebase-admin/firestore'

import { getFirestoreDb } from '@/lib/firebase/server'

// Per-user hot-path state for the Infinite trivia sampler. Lives at
// `users/{uid}/triviaInfiniteMeta/state` alongside `generationLimit`.
//
// Why this exists: the sampler needs to filter recently-seen questions
// without scanning `users/{uid}/seenQuestions` on every /next, and the
// warmer needs an unanswered-pool estimate without count() aggregations
// per request. We mirror a bounded "recent" set + a monotonic seen
// counter onto a single doc so /next reads are O(1) in user history.
//
// `seenQuestions` remains source of truth for analytics; this doc is a
// denormalized cache of the bits the hot path needs.

export const TRIVIA_STATE_DOC_PATH = (uid: string) =>
  `users/${uid}/triviaInfiniteMeta/state`

// Cap recentSeen at this length. Long enough to suppress repeats across
// a typical session; short enough that the doc stays cheap to read.
// Beyond this, the oldest entries are evicted; an extra-long-running
// player may eventually see a question resurface — acceptable.
export const MAX_RECENT_SEEN = 200

// Slack before the sampler trims. Trimming on every read would thrash;
// waiting until we're meaningfully over the cap amortizes the cost.
const TRIM_SLACK = 50

export interface TriviaState {
  recentSeen: string[]
  totalSeenCount: number
  // Set true once we've migrated this user from full-subcollection scans.
  migrated?: boolean
}

export async function readTriviaState(uid: string): Promise<TriviaState | null> {
  const db = getFirestoreDb()
  const snap = await db.doc(TRIVIA_STATE_DOC_PATH(uid)).get()
  if (!snap.exists) return null
  const data = snap.data() as Partial<TriviaState>
  return {
    recentSeen: data.recentSeen ?? [],
    totalSeenCount: data.totalSeenCount ?? 0,
    migrated: data.migrated === true,
  }
}

// One-shot migration for users with a pre-existing `seenQuestions`
// subcollection. Pays the full scan once per user, then every subsequent
// /next reads only the state doc. Idempotent — setting `migrated: true`
// prevents re-running.
export async function ensureMigratedTriviaState(uid: string): Promise<TriviaState> {
  const db = getFirestoreDb()
  const ref = db.doc(TRIVIA_STATE_DOC_PATH(uid))
  const seenSnap = await db.collection(`users/${uid}/seenQuestions`).get()
  const docs = seenSnap.docs

  const sorted = docs.slice().sort((a, b) => {
    const ta = (a.data().at as FirebaseFirestore.Timestamp | undefined)?.toMillis() ?? 0
    const tb = (b.data().at as FirebaseFirestore.Timestamp | undefined)?.toMillis() ?? 0
    return ta - tb
  })
  const tail = sorted.slice(Math.max(0, sorted.length - MAX_RECENT_SEEN))
  const recentSeen = tail.map((d) => d.id)
  const totalSeenCount = docs.length

  const state: TriviaState = { recentSeen, totalSeenCount, migrated: true }
  await ref.set(state, { merge: true })
  return state
}

// Build the write update that records a question as seen on the state
// doc. Caller passes this into a transaction's `tx.set(ref, update,
// { merge: true })` or a plain `ref.set(update, { merge: true })`.
// Uses arrayUnion + increment so no read is required on the write path.
//
// `set` with `{ merge: true }` rather than `update` so the first write
// for a brand-new user creates the doc; `update` would throw.
export function buildMarkSeenWrite(
  uid: string,
  questionId: string
): {
  ref: FirebaseFirestore.DocumentReference
  data: { recentSeen: FirebaseFirestore.FieldValue; totalSeenCount: FirebaseFirestore.FieldValue }
} {
  const db = getFirestoreDb()
  const ref = db.doc(TRIVIA_STATE_DOC_PATH(uid))
  return {
    ref,
    data: {
      recentSeen: FieldValue.arrayUnion(questionId),
      totalSeenCount: FieldValue.increment(1),
    },
  }
}

// Returns the trimmed array if recentSeen has grown past MAX + slack;
// returns null if no trim needed. The sampler calls this opportunistically
// and writes back fire-and-forget. Concurrent arrayUnion writes from the
// hot path are preserved across the trim window because we evict by value
// (arrayRemove), not by overwriting the whole array.
export function computeTrim(recentSeen: string[]): string[] | null {
  if (recentSeen.length <= MAX_RECENT_SEEN + TRIM_SLACK) return null
  const evictCount = recentSeen.length - MAX_RECENT_SEEN
  return recentSeen.slice(0, evictCount)
}

// Fire-and-forget trim; never throws. Uses arrayRemove so concurrent
// writes (which arrayUnion at the tail) are not clobbered.
export async function trimRecentSeen(uid: string, evict: string[]): Promise<void> {
  if (evict.length === 0) return
  const db = getFirestoreDb()
  try {
    await db.doc(TRIVIA_STATE_DOC_PATH(uid)).update({
      recentSeen: FieldValue.arrayRemove(...evict),
    })
  } catch (err) {
    console.warn('[triviaState] trim failed', {
      uid,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
