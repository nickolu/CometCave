import { type NextRequest, NextResponse } from 'next/server';

import { verifyRequestAuth } from '@/lib/api/auth';
import { getFirestoreDb } from '@/lib/firebase/server';
import { judgeAnswer } from '@/lib/trivia/answerJudge';
import { submitAnswer } from '@/lib/trivia/infiniteRuns';
import { getTopWrongAnswers, recordWrongAnswer } from '@/lib/trivia/wrongAnswers';

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

    if (!questionId || elapsedMs === undefined) {
      return NextResponse.json({ error: 'questionId and elapsedMs are required.' }, { status: 400 });
    }

    // Empty answer (timeout) is treated as incorrect — skip the judge
    const isTimeout = !answer || typeof answer !== 'string' || answer.trim() === ''

    // Load question
    const db = getFirestoreDb();
    const qSnap = await db.doc(`aiQuestions/${questionId}`).get();
    if (!qSnap.exists || qSnap.data()?.status !== 'active') {
      return NextResponse.json({ error: 'Question not found or inactive.' }, { status: 404 });
    }
    const qData = qSnap.data()!;

    // Grade the answer — timeout (empty) is automatically incorrect
    const correct = isTimeout ? false : await judgeAnswer(qData.question, qData.correctAnswer, answer);

    // Submit to run
    const result = await submitAnswer({
      uid: auth.claims.uid,
      runId,
      questionId,
      correct,
      elapsedMs: typeof elapsedMs === 'number' ? elapsedMs : 0,
    });

    // Read updated question stats for community accuracy
    const updatedQSnap = await db.doc(`aiQuestions/${questionId}`).get();
    const updatedQ = updatedQSnap.data();
    const timesShown = updatedQ?.timesShown ?? 1;
    const timesCorrect = updatedQ?.timesCorrect ?? 0;

    let topWrongAnswers: Array<{ text: string; count: number }> = []
    if (!correct && !isTimeout) {
      // Fire-and-forget the write so it doesn't block the response
      recordWrongAnswer(questionId, answer).catch((err) =>
        console.error('Failed to record wrong answer:', err),
      )
      topWrongAnswers = await getTopWrongAnswers(questionId, 5).catch(() => [])
    }

    return NextResponse.json({
      ...result,
      correctAnswer: qData.correctAnswer,
      explanation: qData.explanation ?? null,
      timesShown,
      timesCorrect,
      topWrongAnswers,
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
