import { type NextRequest, NextResponse } from 'next/server';

import { verifyRequestAuth } from '@/lib/api/auth';
import { getFirestoreDb } from '@/lib/firebase/server';
import { recordSkip } from '@/lib/trivia/infiniteRuns';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const auth = await verifyRequestAuth(request);
  if ('error' in auth) return auth.error;

  const { runId } = await params;

  try {
    const body = await request.json();
    const { questionId } = body;

    if (!questionId || typeof questionId !== 'string') {
      return NextResponse.json({ error: 'questionId is required.' }, { status: 400 });
    }

    await recordSkip(auth.claims.uid, runId, questionId);

    // Return the correct answer and community stats so the client can show them
    let correctAnswer: string | null = null;
    let explanation: string | null = null;
    let timesShown = 0;
    let timesCorrect = 0;
    if (questionId) {
      const db = getFirestoreDb();
      const qSnap = await db.doc(`aiQuestions/${questionId}`).get();
      if (qSnap.exists) {
        const qData = qSnap.data()!;
        correctAnswer = qData.correctAnswer ?? null;
        explanation = qData.explanation ?? null;
        timesShown = qData.timesShown ?? 0;
        timesCorrect = qData.timesCorrect ?? 0;
      }
    }

    return NextResponse.json({ ok: true, correctAnswer, explanation, timesShown, timesCorrect });
  } catch (err: unknown) {
    console.error('Failed to record skip:', err);
    return NextResponse.json({ error: 'Failed to record skip.' }, { status: 500 });
  }
}
