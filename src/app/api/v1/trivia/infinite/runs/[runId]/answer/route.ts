import { type NextRequest, NextResponse } from 'next/server';

import { verifyRequestAuth } from '@/lib/api/auth';
import { getFirestoreDb } from '@/lib/firebase/server';
import { judgeAnswer } from '@/lib/trivia/answerJudge';
import { submitAnswer } from '@/lib/trivia/infiniteRuns';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const auth = await verifyRequestAuth(request);
  if ('error' in auth) return auth.error;

  const { runId } = await params;

  try {
    const body = await request.json();
    const { questionId, answer, elapsedMs } = body;

    if (!questionId || !answer || elapsedMs === undefined) {
      return NextResponse.json({ error: 'questionId, answer, and elapsedMs are required.' }, { status: 400 });
    }

    // Load question
    const db = getFirestoreDb();
    const qSnap = await db.doc(`aiQuestions/${questionId}`).get();
    if (!qSnap.exists || qSnap.data()?.status !== 'active') {
      return NextResponse.json({ error: 'Question not found or inactive.' }, { status: 404 });
    }
    const qData = qSnap.data()!;

    // Grade the answer
    const correct = await judgeAnswer(qData.question, qData.correctAnswer, answer);

    // Submit to run
    const result = await submitAnswer({
      uid: auth.claims.uid,
      runId,
      questionId,
      correct,
      elapsedMs: typeof elapsedMs === 'number' ? elapsedMs : 0,
    });

    return NextResponse.json({
      ...result,
      correctAnswer: qData.correctAnswer,
      explanation: qData.explanation ?? null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'Run already ended') {
      return NextResponse.json({ error: 'Run already ended.' }, { status: 409 });
    }
    if (message === 'Run not found') {
      return NextResponse.json({ error: 'Run not found.' }, { status: 404 });
    }
    console.error('Failed to submit answer:', err);
    return NextResponse.json({ error: 'Failed to submit answer.' }, { status: 500 });
  }
}
