import { type NextRequest, NextResponse } from 'next/server';

import { verifyRequestAuth } from '@/lib/api/auth';
import { getFirestoreDb } from '@/lib/firebase/server';
import { CATEGORY_META } from '@/lib/trivia/categories';
import { startRun } from '@/lib/trivia/infiniteRuns';
import { ensureAnonymousFlag } from '@/lib/users/profile';

export async function GET(request: NextRequest) {
  const auth = await verifyRequestAuth(request)
  if ('error' in auth) return auth.error

  const uid = auth.claims.uid
  const limitParam = request.nextUrl.searchParams.get('limit')
  const limit = Math.min(Math.max(parseInt(limitParam || '20', 10) || 20, 1), 50)

  try {
    const db = getFirestoreDb()
    const snap = await db
      .collection(`users/${uid}/triviaInfinite`)
      .where('endedAt', '!=', null)
      .orderBy('endedAt', 'desc')
      .limit(limit)
      .get()

    const runs = snap.docs.map((d) => {
      const data = d.data()
      return {
        runId: data.runId,
        mode: data.mode,
        score: data.score,
        longestStreak: data.longestStreak,
        questionsAnswered: data.answers?.length ?? 0,
        skipsUsed: data.skipsUsed ?? 0,
        endedAt: data.endedAt?.toMillis() ?? null,
      }
    })

    return NextResponse.json({ runs })
  } catch (error) {
    console.error('Error fetching run history:', error)
    return NextResponse.json({ error: 'Failed to fetch runs.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyRequestAuth(request);
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();
    const mode = body.mode === 'practice' ? 'practice' : 'scored';

    // Parse and validate customCategory — mutually exclusive with preset categories.
    const MAX_CUSTOM_CATEGORY_LENGTH = 100
    let customCategory: string | null = null
    if (typeof body.customCategory === 'string') {
      const trimmed = body.customCategory.trim().toLowerCase()
      if (trimmed.length >= 3 && trimmed.length <= MAX_CUSTOM_CATEGORY_LENGTH) {
        customCategory = trimmed
      }
    }

    // Parse and validate categoryIds (preferred) — falls back to the legacy
    // single categoryId field for backward compatibility.
    // Ignored when customCategory is set.
    let categoryIds: number[] = []
    if (!customCategory) {
      if (Array.isArray(body.categoryIds)) {
        categoryIds = body.categoryIds
          .map((v: unknown) => Number(v))
          .filter((n: number) => !isNaN(n) && n in CATEGORY_META)
      } else if (body.categoryId !== undefined && body.categoryId !== null) {
        const parsed = Number(body.categoryId)
        if (!isNaN(parsed) && parsed in CATEGORY_META) {
          categoryIds = [parsed]
        }
      }
    }

    // Keep the user doc's isAnonymous flag fresh so the leaderboard reader
    // can filter anonymous players out without snapshotting per-run.
    await ensureAnonymousFlag(auth.claims);

    const result = await startRun(auth.claims.uid, mode, categoryIds, customCategory);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error('Failed to start infinite run:', err);
    return NextResponse.json({ error: 'Failed to start run.' }, { status: 500 });
  }
}
