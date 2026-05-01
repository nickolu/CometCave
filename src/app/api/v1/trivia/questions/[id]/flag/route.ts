import { FieldValue } from 'firebase-admin/firestore';
import { type NextRequest, NextResponse } from 'next/server';

import { verifyRequestAuth } from '@/lib/api/auth';
import { getFirestoreDb } from '@/lib/firebase/server';
import { incrementVoiceStat } from '@/lib/trivia/triviaStats';

const BONUS_LIVES_PER_RUN = 1;
const VALID_REASONS = ['obvious', 'unanswerable', 'nonsense', 'inaccurate', 'difficulty_mismatch', 'other'] as const;
type FlagReason = (typeof VALID_REASONS)[number];

// One flag from any user is enough to remove a question from rotation.
// We no longer maintain a denormalized flaggedCount on the question doc;
// the flags subcollection is the source of truth. If the threshold is
// ever raised above 1, this route can read the subcollection (or use a
// Firestore aggregation count) inside the transaction.

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

  const runRef = validRunId ? db.doc(`users/${uid}/triviaInfinite/${validRunId}`) : null;

  try {
    const result = await db.runTransaction(async (tx) => {
      // Firestore transactions require all reads before any writes.
      // Read the question doc and (optionally) the run doc up front,
      // then do every write below.
      const qSnap = await tx.get(qRef);
      if (!qSnap.exists) throw new Error('Question not found');
      const runSnap = runRef ? await tx.get(runRef) : null;

      const qData = qSnap.data()!;
      const runData = runSnap?.exists ? runSnap.data()! : null;
      const bonusLivesEarned = runData?.bonusLivesEarned ?? 0;
      const shouldGrantBonusLife = runData !== null && bonusLivesEarned < BONUS_LIVES_PER_RUN;

      // ── all writes below ──────────────────────────────────────────

      // Only flip status from active → flagged. Already-flagged or removed
      // questions stay where they are (still record this user's flag doc).
      if (qData.status === 'active') {
        tx.update(qRef, { status: 'flagged' });
      }

      // Store uid + questionId as fields too — the doc id is already the
      // uid, but having them as fields lets us do collection-group queries
      // ("all flags by user X") and lets admin tooling display them.
      const flagDoc: Record<string, unknown> = {
        uid,
        questionId,
        reason,
        flaggedAt: FieldValue.serverTimestamp(),
      };
      if (note !== undefined) {
        flagDoc.note = note;
      }
      tx.set(flagRef, flagDoc);

      // Award one bonus life per run (capped) when a flag is filed during play.
      if (runRef && runData) {
        const runUpdates: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
          flaggedQuestionIds: FieldValue.arrayUnion(questionId),
        };
        if (shouldGrantBonusLife) {
          runUpdates.livesRemaining = FieldValue.increment(1);
          runUpdates.bonusLivesEarned = FieldValue.increment(1);
        }
        tx.update(runRef, runUpdates);
      }

      return { bonusLifeGranted: shouldGrantBonusLife };
    });

    // Increment lifetime reports counter (independent of the flag tx;
    // owned by incrementVoiceStat exclusively after the run-aggregate fix).
    await incrementVoiceStat(uid, 'reportsFiled').catch((err) =>
      console.error('[flag] Failed to increment voice stat:', err)
    );

    return NextResponse.json({ ok: true, bonusLifeGranted: result.bonusLifeGranted }, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message === 'Question not found') {
      return NextResponse.json({ error: 'Question not found.' }, { status: 404 });
    }
    console.error('Failed to flag question:', err);
    return NextResponse.json({ error: 'Failed to flag question.' }, { status: 500 });
  }
}
