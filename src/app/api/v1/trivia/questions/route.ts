import { type NextRequest, NextResponse } from 'next/server'

import { verifyRequestAuth } from '@/lib/api/auth'
import { getFirestoreDb } from '@/lib/firebase/server'
import type { AIQuestion } from '@/lib/trivia/aiQuestions'
import {
  VALID_SORTS,
  buildQuestionBrowseQuery,
  computeAccuracy,
  decodeCursor,
  encodeCursor,
  isAccuracySort,
  toQuestionBrowseRow,
} from '@/lib/trivia/questionQueries'
import { TRIVIA_STATE_DOC_PATH } from '@/lib/trivia/triviaState'

const MAX_LIMIT = 50
const DEFAULT_LIMIT = 20

// GET /api/v1/trivia/questions
// Query params: sort, category, difficulty, cursor, limit
export async function GET(request: NextRequest) {
  const authResult = await verifyRequestAuth(request)
  if ('error' in authResult) return authResult.error
  const { claims } = authResult

  const { searchParams } = new URL(request.url)

  // ── Parse + validate query params ─────────────────────────────────────────

  const sortParam = (searchParams.get('sort') ?? 'newest') as string
  if (!VALID_SORTS.includes(sortParam as (typeof VALID_SORTS)[number])) {
    return NextResponse.json(
      {
        error: `Invalid sort. Must be one of: ${VALID_SORTS.join(', ')}.`,
      },
      { status: 400 }
    )
  }
  const sort = sortParam as (typeof VALID_SORTS)[number]

  const category = searchParams.get('category') ?? undefined
  const difficulty = searchParams.get('difficulty') ?? undefined

  if (difficulty && !['easy', 'medium', 'hard'].includes(difficulty)) {
    return NextResponse.json(
      { error: 'Invalid difficulty. Must be one of: easy, medium, hard.' },
      { status: 400 }
    )
  }

  const limitParam = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10)
  const limit = isNaN(limitParam) || limitParam < 1 ? DEFAULT_LIMIT : Math.min(limitParam, MAX_LIMIT)

  const cursorParam = searchParams.get('cursor')
  const cursor = cursorParam ? decodeCursor(cursorParam) : undefined
  if (cursorParam && !cursor) {
    return NextResponse.json({ error: 'Invalid cursor.' }, { status: 400 })
  }

  try {
    // ── Fetch seen question IDs from the user's state doc ──────────────────

    const db = getFirestoreDb()
    const stateSnap = await db.doc(TRIVIA_STATE_DOC_PATH(claims.uid)).get()
    const recentSeen: string[] = stateSnap.exists
      ? ((stateSnap.data() as { recentSeen?: string[] }).recentSeen ?? [])
      : []
    const seenSet = new Set(recentSeen)

    // ── Build and execute Firestore query ──────────────────────────────────

    // For accuracy sorts: over-fetch so we have enough data to sort in code.
    const fetchLimit = isAccuracySort(sort) ? limit * 3 : limit + 1

    const q = buildQuestionBrowseQuery({ sort, category, difficulty, cursor: cursor ?? undefined, fetchLimit })
    const snap = await q.get()

    // ── Transform docs ─────────────────────────────────────────────────────

    type DocData = Omit<AIQuestion, 'correctAnswer' | 'seed'> & {
      correctAnswer?: unknown
      seed?: unknown
      createdAt?: { toDate?: () => Date } | string | null
    }

    const rows = snap.docs.map((doc) =>
      toQuestionBrowseRow(doc.id, doc.data() as DocData, seenSet)
    )

    // ── Accuracy sorts: sort + paginate in code ────────────────────────────

    if (isAccuracySort(sort)) {
      // Sort by computed accuracy
      rows.sort((a, b) =>
        sort === 'accuracy_asc'
          ? a.accuracyPct - b.accuracyPct || a.id.localeCompare(b.id)
          : b.accuracyPct - a.accuracyPct || a.id.localeCompare(b.id)
      )

      // Apply cursor offset in code
      let startIndex = 0
      if (cursor) {
        const { sortValue: cursorAccuracy, docId: cursorDocId } = cursor
        const idx = rows.findIndex(
          (r) => r.id === cursorDocId && r.accuracyPct === cursorAccuracy
        )
        if (idx !== -1) startIndex = idx + 1
      }

      const page = rows.slice(startIndex, startIndex + limit)
      const hasMore = startIndex + limit < rows.length

      const lastRow = page[page.length - 1]
      const nextCursor =
        hasMore && lastRow
          ? encodeCursor({ sortValue: lastRow.accuracyPct, docId: lastRow.id })
          : null

      return NextResponse.json({ questions: page, nextCursor, hasMore })
    }

    // ── Firestore-sorted result: detect hasMore via over-fetch ─────────────

    // We fetched limit + 1 docs. If we got that many, there is a next page.
    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows

    // Build the cursor from the last row on the page and the Firestore
    // sort field value.
    const lastDoc = hasMore ? snap.docs[limit - 1] : snap.docs[snap.docs.length - 1]
    let nextCursor: string | null = null

    if (hasMore && lastDoc) {
      const lastData = lastDoc.data() as DocData & Record<string, unknown>
      let sortValue: unknown

      switch (sort) {
        case 'liked':
        case 'trending':
          sortValue = lastData.likeCount ?? 0
          break
        case 'disliked':
          sortValue = lastData.dislikeCount ?? 0
          break
        case 'newest':
        case 'oldest': {
          const cd = lastData.createdAt as { toDate?: () => Date } | string | null | undefined
          if (cd && typeof cd === 'object' && typeof cd.toDate === 'function') {
            sortValue = cd.toDate().toISOString()
          } else {
            sortValue = cd ?? null
          }
          break
        }
        case 'most_shown':
          sortValue = lastData.timesShown ?? 0
          break
        default:
          sortValue = null
      }

      nextCursor = encodeCursor({ sortValue, docId: lastDoc.id })
    }

    return NextResponse.json({ questions: page, nextCursor, hasMore })
  } catch (err) {
    console.error('[trivia/questions] Failed to fetch questions:', err)
    return NextResponse.json({ error: 'Failed to fetch questions.' }, { status: 500 })
  }
}
