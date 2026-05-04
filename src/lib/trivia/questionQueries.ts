import type { Query, CollectionReference } from 'firebase-admin/firestore'

import { getFirestoreDb } from '@/lib/firebase/server'
import type { AIQuestion } from '@/lib/trivia/aiQuestions'

// ── Sort types ────────────────────────────────────────────────────────────────

export type SortOption =
  | 'liked'
  | 'disliked'
  | 'trending'
  | 'accuracy_asc'
  | 'accuracy_desc'
  | 'newest'
  | 'oldest'
  | 'most_shown'

export const VALID_SORTS: SortOption[] = [
  'liked',
  'disliked',
  'trending',
  'accuracy_asc',
  'accuracy_desc',
  'newest',
  'oldest',
  'most_shown',
]

// Whether a sort is computed in code rather than via a Firestore orderBy.
export function isAccuracySort(sort: SortOption): boolean {
  return sort === 'accuracy_asc' || sort === 'accuracy_desc'
}

// ── Cursor encoding / decoding ────────────────────────────────────────────────

export interface BrowseCursor {
  // The value of the sort field for the last document on the previous page
  // (or the computed accuracyPct for accuracy sorts).
  sortValue: unknown
  docId: string
}

export function encodeCursor(cursor: BrowseCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64')
}

export function decodeCursor(raw: string): BrowseCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'))
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('docId' in parsed) ||
      typeof parsed.docId !== 'string'
    ) {
      return null
    }
    return { sortValue: parsed.sortValue, docId: parsed.docId }
  } catch {
    return null
  }
}

// ── Accuracy computation ──────────────────────────────────────────────────────

export function computeAccuracy(timesShown: number, timesCorrect: number): number {
  if (timesShown === 0) return 0
  return Math.round((timesCorrect / timesShown) * 1000) / 10 // one decimal
}

// ── Query builder ─────────────────────────────────────────────────────────────

export interface BuildQueryOptions {
  sort: SortOption
  category?: string
  difficulty?: string
  cursor?: BrowseCursor
  // How many docs to fetch from Firestore. For accuracy sorts the caller
  // passes limit * 3 so there is enough data to sort and slice in code.
  fetchLimit: number
}

export function buildQuestionBrowseQuery(opts: BuildQueryOptions): Query {
  const db = getFirestoreDb()
  let q: Query | CollectionReference = db.collection('aiQuestions')

  // Always filter to active free-text questions only.
  q = q.where('status', '==', 'active').where('type', '==', 'free-text')

  if (opts.category) {
    q = q.where('category', '==', opts.category)
  }
  if (opts.difficulty) {
    q = q.where('difficulty', '==', opts.difficulty)
  }

  // For accuracy sorts we fetch an over-sized batch and sort in code, so
  // we don't apply a Firestore orderBy for the accuracy field (it doesn't
  // exist on the doc). We still need a deterministic secondary sort by
  // docId so we can paginate reliably with __name__.
  if (isAccuracySort(opts.sort)) {
    // No primary sort field — Firestore will use default doc order.
    // Secondary __name__ sort is added by Firestore automatically when no
    // orderBy is specified; we don't add cursor pagination here because
    // accuracy pagination is done in code.
    q = q.limit(opts.fetchLimit)
    return q
  }

  // Map sort options to Firestore orderBy fields and directions.
  let sortField: string
  let sortDir: 'asc' | 'desc'

  switch (opts.sort) {
    case 'liked':
    case 'trending': // Trending uses likeCount for now (no recent-rating data yet)
      sortField = 'likeCount'
      sortDir = 'desc'
      break
    case 'disliked':
      sortField = 'dislikeCount'
      sortDir = 'desc'
      break
    case 'newest':
      sortField = 'createdAt'
      sortDir = 'desc'
      break
    case 'oldest':
      sortField = 'createdAt'
      sortDir = 'asc'
      break
    case 'most_shown':
      sortField = 'timesShown'
      sortDir = 'desc'
      break
    case 'accuracy_asc':
    case 'accuracy_desc':
      // Should never reach here — isAccuracySort() returns early above.
      sortField = 'likeCount'
      sortDir = 'desc'
      break
    default: {
      // Exhaustiveness check
      const _exhaustive: never = opts.sort
      void _exhaustive
      sortField = 'likeCount'
      sortDir = 'desc'
      break
    }
  }

  // Add __name__ as a tiebreaker so cursor pagination is stable.
  q = q.orderBy(sortField, sortDir).orderBy('__name__', sortDir)

  if (opts.cursor) {
    q = q.startAfter(opts.cursor.sortValue, opts.cursor.docId)
  }

  q = q.limit(opts.fetchLimit)
  return q
}

// ── Row type returned by the browse helpers ───────────────────────────────────

export interface QuestionBrowseRow {
  id: string
  question: string
  category: string
  difficulty: 'easy' | 'medium' | 'hard'
  timesShown: number
  timesCorrect: number
  accuracyPct: number
  likeCount: number
  dislikeCount: number
  createdAt: string | null
  userHasSeen: boolean
}

// ── Map a Firestore doc to a safe client row ──────────────────────────────────

export function toQuestionBrowseRow(
  id: string,
  // Omit secret fields at the type level — we never touch them here.
  data: Omit<AIQuestion, 'correctAnswer' | 'seed'> & { correctAnswer?: unknown; seed?: unknown; createdAt?: { toDate?: () => Date } | string | null },
  seenSet: Set<string>
): QuestionBrowseRow {
  const timesShown = data.timesShown ?? 0
  const timesCorrect = data.timesCorrect ?? 0
  const accuracyPct = computeAccuracy(timesShown, timesCorrect)

  let createdAt: string | null = null
  if (data.createdAt) {
    if (typeof data.createdAt === 'string') {
      createdAt = data.createdAt
    } else if (typeof (data.createdAt as { toDate?: () => Date }).toDate === 'function') {
      createdAt = (data.createdAt as { toDate: () => Date }).toDate().toISOString()
    }
  }

  return {
    id,
    question: data.question,
    category: data.category,
    difficulty: data.difficulty,
    timesShown,
    timesCorrect,
    accuracyPct,
    likeCount: data.likeCount ?? 0,
    dislikeCount: data.dislikeCount ?? 0,
    createdAt,
    userHasSeen: seenSet.has(id),
  }
}
