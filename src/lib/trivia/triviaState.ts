import { FieldValue } from 'firebase-admin/firestore'

import { getFirestoreDb } from '@/lib/firebase/server'

// Per-user hot-path state for the Infinite trivia sampler. Lives at
// `users/{uid}/triviaInfiniteMeta/state` alongside `generationLimit`.
//
// Why this exists: the sampler needs to filter every previously-seen
// question without scanning `users/{uid}/seenQuestions` on each /next,
// and the warmer needs an unanswered-pool estimate without count()
// aggregations per request. We mirror the full set of seen ids + a
// monotonic counter onto a single doc so /next reads are O(1) in user
// history.
//
// `seenQuestions` remains source of truth for analytics; this doc is a
// denormalized cache of the bits the hot path needs.

export const TRIVIA_STATE_DOC_PATH = (uid: string) =>
  `users/${uid}/triviaInfiniteMeta/state`

// Bump when the migration semantics change. Anything below this number
// re-runs ensureMigratedTriviaState on the next /next.
//   v1 — initial migration; capped recentSeen at 200, evicting older
//        ids and letting them resurface (regression).
//   v2 — store the full seen-id set so the filter is exhaustive.
//   v3 — initialize the per-player unanswered-pool cache lazily on
//        first /next; the migration bump is informational so the
//        sampler knows to wipe any stale pre-v3 pool shape if present.
export const CURRENT_MIGRATION_VERSION = 3

// One entry in the per-player unanswered-pool cache. Holds only the
// fields the sampler needs (id, category, difficulty + the random/
// timesShown values that drive the weighted pick). The full question
// doc is fetched lazily once the sampler has chosen which id to return,
// so this stays well under Firestore's 1 MiB per-doc budget even for
// players with thousands of unanswered questions.
export interface UnansweredPoolEntry {
  id: string
  category: string
  difficulty: 'easy' | 'medium' | 'hard'
  random: number
  timesShown: number
}

// Context the cache was built against. Sampler must rebuild when the
// current request's categoryIds (canonicalized via canonicalCategoryKey)
// don't match — different filters legitimately need different pools.
export interface UnansweredPoolMeta {
  // Sorted categoryId list, or [] for all-categories runs. Used to
  // detect when a player rotates filters and the cache no longer
  // matches what they're asking for.
  categoryIds: number[]
  // ms-since-epoch wall clock of the last rebuild. Diagnostic; the
  // poolTick counter is what drives the periodic refresh.
  refreshedAt: number
}

export interface TriviaState {
  recentSeen: string[]
  totalSeenCount: number
  // Highest migration version this doc satisfies. Older docs (v1 only,
  // which used the legacy `migrated: true` boolean) are treated as
  // version 1 by readTriviaState and re-migrated to the current version.
  migrationVersion: number
  // Cached pool of unanswered candidate questions for this player.
  // Sampler pops from here instead of re-running the 300-doc Firestore
  // scan on every /next. Rebuilt when empty, when the requested
  // categoryIds no longer match the cache's context, or every
  // POOL_REFRESH_EVERY_N /next calls (to pick up questions other
  // players have generated since the last rebuild).
  unansweredPool?: UnansweredPoolEntry[]
  unansweredPoolMeta?: UnansweredPoolMeta
  // Monotonic /next counter. Sampler triggers a periodic rebuild when
  // poolTick % POOL_REFRESH_EVERY_N === 0 so a long-running cache
  // doesn't stay blind to freshly-generated questions.
  poolTick?: number
}

export async function readTriviaState(uid: string): Promise<TriviaState | null> {
  const db = getFirestoreDb()
  const snap = await db.doc(TRIVIA_STATE_DOC_PATH(uid)).get()
  if (!snap.exists) return null
  const data = snap.data() as {
    recentSeen?: string[]
    totalSeenCount?: number
    migrationVersion?: number
    migrated?: boolean
    unansweredPool?: UnansweredPoolEntry[]
    unansweredPoolMeta?: UnansweredPoolMeta
    poolTick?: number
  }
  // Legacy v1 docs only set `migrated: true`. Treat as version 1 so the
  // sampler triggers a re-migration that fills in the rest of the seen ids.
  const migrationVersion = typeof data.migrationVersion === 'number'
    ? data.migrationVersion
    : data.migrated === true ? 1 : 0
  return {
    recentSeen: data.recentSeen ?? [],
    totalSeenCount: data.totalSeenCount ?? 0,
    migrationVersion,
    ...(data.unansweredPool !== undefined ? { unansweredPool: data.unansweredPool } : {}),
    ...(data.unansweredPoolMeta !== undefined ? { unansweredPoolMeta: data.unansweredPoolMeta } : {}),
    ...(data.poolTick !== undefined ? { poolTick: data.poolTick } : {}),
  }
}

// One-shot migration: pulls every id from `seenQuestions` onto the state
// doc so the sampler can filter exhaustively from a single read. Pays
// the full subcollection scan once per user (or once per migration-
// version bump); every subsequent /next is one doc read.
//
// Idempotent. Safe to call concurrently — last write wins, the result
// is the same.
//
// Doc-size note: a typical user is well under 1 MiB even after years of
// play (~25 bytes/id, ~30K ids = ~750 KB). If we ever need to support
// users past that point, shard the array across `triviaInfiniteMeta/
// seen-{n}` chunks.
export async function ensureMigratedTriviaState(uid: string): Promise<TriviaState> {
  const db = getFirestoreDb()
  const ref = db.doc(TRIVIA_STATE_DOC_PATH(uid))
  const seenSnap = await db.collection(`users/${uid}/seenQuestions`).get()
  const recentSeen = seenSnap.docs.map((d) => d.id)
  const totalSeenCount = recentSeen.length

  const state: TriviaState = {
    recentSeen,
    totalSeenCount,
    migrationVersion: CURRENT_MIGRATION_VERSION,
  }
  // `set` with `{ merge: true }` so we don't clobber any unrelated
  // fields a future writer might add to the doc.
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

// Canonical key for a categoryIds array. Used by the sampler to detect
// when the cached unanswered pool was built for a different filter than
// the current request. Sort + join keeps the comparison stable
// regardless of caller ordering.
export function canonicalCategoryKey(categoryIds: number[] | undefined): string {
  if (!categoryIds || categoryIds.length === 0) return ''
  return [...categoryIds].sort((a, b) => a - b).join(',')
}

// Write the sampler's updated cache state back to the state doc. Sent
// as a single set-with-merge so the seen-set / migration fields it
// leaves alone are preserved. Caller passes the entries to persist
// (already popped of the question being returned this request), the
// categoryIds context the pool was built against, and the latest tick.
export async function writeUnansweredPool(
  uid: string,
  entries: UnansweredPoolEntry[],
  categoryIds: number[],
  poolTick: number,
): Promise<void> {
  const db = getFirestoreDb()
  const ref = db.doc(TRIVIA_STATE_DOC_PATH(uid))
  await ref.set(
    {
      unansweredPool: entries,
      unansweredPoolMeta: {
        categoryIds: [...categoryIds].sort((a, b) => a - b),
        refreshedAt: Date.now(),
      },
      poolTick,
    },
    { merge: true },
  )
}
