import { type NextRequest, NextResponse } from 'next/server';

import { verifyRequestAuth } from '@/lib/api/auth';
import { getFirestoreDb } from '@/lib/firebase/server';
import { startRun } from '@/lib/trivia/infiniteRuns';
import { CATEGORY_META } from '@/lib/trivia/categories';
<<<<<<< HEAD
=======

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
>>>>>>> origin/main

export async function POST(request: NextRequest) {
  const auth = await verifyRequestAuth(request);
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();
    const mode = body.mode === 'practice' ? 'practice' : 'scored';

    // Parse and validate optional categoryId
    let categoryId: number | undefined
    if (body.categoryId !== undefined && body.categoryId !== null) {
      const parsed = Number(body.categoryId)
      if (!isNaN(parsed) && parsed in CATEGORY_META) {
        categoryId = parsed
      }
    }

    const result = await startRun(auth.claims.uid, mode, categoryId);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error('Failed to start infinite run:', err);
    return NextResponse.json({ error: 'Failed to start run.' }, { status: 500 });
  }
}
