import { type NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';

import { verifyRequestAuth } from '@/lib/api/auth';
import { getFirestoreDb } from '@/lib/firebase/server';
import { incrementVoiceStat } from '@/lib/trivia/triviaStats';

const FLAG_THRESHOLD = 3;
const BONUS_LIVES_MAX = 3;
const VALID_REASONS = ['obvious', 'unanswerable', 'nonsense', 'inaccurate', 'difficulty_mismatch', 'other'] as const;
type FlagReason = (typeof VALID_REASONS)[number];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyRequestAuth(request);
  if ('error' in auth) return auth.error;

  const { id: questionId } = await params;
  const uid = auth.claims.uid;

  let body: { reason?: unknown; note?: unknown; runId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { reason, note, runId } = body;

  if (!VALID_REASONS.includes(reason as FlagReason)) {
    return NextResponse.json(
      { error: `Invalid reason. Must be one of: ${VALID_REASONS.join(', ')}.` },
      { status: 400 }
    );
  }

  if (note !== undefined && (typeof note !== 'string' || note.length > 500)) {
    return NextResponse.json({ error: 'Note must be a string of max 500 characters.' }, { status: 400 });
  }

  const validRunId = typeof runId === 'string' && runId.length > 0 ? runId : null;

  const db = getFirestoreDb();
  const qRef = db.doc(`aiQuestions/${questionId}`);
  const flagRef = db.doc(`aiQuestions/${questionId}/flags/${uid}`);

  try {
    const result = await db.runTransaction(async (tx) => {
      const qSnap = await tx.get(qRef);
      if (!qSnap.exists) throw new Error('Question not found');

      const qData = qSnap.data()!;
      const currentFlaggedCount = qData.flaggedCount ?? 0;
      const newFlaggedCount = currentFlaggedCount + 1;
      const wasFirstFlag = currentFlaggedCount === 0;

      const qUpdates: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
        flaggedCount: FieldValue.increment(1),
      };

      if (newFlaggedCount >= FLAG_THRESHOLD && qData.status === 'active') {
        qUpdates.status = 'flagged';
      }

      tx.update(qRef, qUpdates);

      const flagDoc: Record<string, unknown> = {
        reason,
        flaggedAt: FieldValue.serverTimestamp(),
      };
      if (note !== undefined) {
        flagDoc.note = note;
      }
      tx.set(flagRef, flagDoc);

      // Handle run updates if a runId is provided
      let bonusLifeGranted = false;
      if (validRunId) {
        const runRef = db.doc(`users/${uid}/triviaInfinite/${validRunId}`);
        const runSnap = await tx.get(runRef);
        if (runSnap.exists) {
          const runData = runSnap.data()!;
          const bonusLivesEarned = runData.bonusLivesEarned ?? 0;

          const runUpdates: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
            flaggedQuestionIds: FieldValue.arrayUnion(questionId),
          };

          if (wasFirstFlag && bonusLivesEarned < BONUS_LIVES_MAX) {
            runUpdates.livesRemaining = FieldValue.increment(1);
            runUpdates.bonusLivesEarned = FieldValue.increment(1);
            bonusLifeGranted = true;
          }

          tx.update(runRef, runUpdates);
        }
      }

      return { wasFirstFlag, bonusLifeGranted };
    });

    // Increment lifetime reports counter (fire-and-forget)
    incrementVoiceStat(uid, 'reportsFiled').catch((err) =>
      console.error('[flag] Failed to increment voice stat:', err)
    );

    return NextResponse.json({ ok: true, wasFirstFlag: result.wasFirstFlag, bonusLifeGranted: result.bonusLifeGranted }, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message === 'Question not found') {
      return NextResponse.json({ error: 'Question not found.' }, { status: 404 });
    }
    console.error('Failed to flag question:', err);
    return NextResponse.json({ error: 'Failed to flag question.' }, { status: 500 });
  }
}
