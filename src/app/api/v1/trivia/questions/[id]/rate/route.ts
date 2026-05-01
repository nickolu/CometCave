import { FieldValue } from 'firebase-admin/firestore';
import { type NextRequest, NextResponse } from 'next/server';

import { verifyRequestAuth } from '@/lib/api/auth';
import { getFirestoreDb } from '@/lib/firebase/server';
import { incrementVoiceStat } from '@/lib/trivia/triviaStats';

const VALID_VOTES = ['up', 'down'] as const;
type Vote = (typeof VALID_VOTES)[number];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyRequestAuth(request);
  if ('error' in auth) return auth.error;

  const { id: questionId } = await params;
  const uid = auth.claims.uid;

  let body: { vote?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { vote: rawVote } = body;

  if (rawVote !== null && !VALID_VOTES.includes(rawVote as Vote)) {
    return NextResponse.json(
      { error: 'Invalid vote. Must be "up", "down", or null.' },
      { status: 400 }
    );
  }
  const newVote: Vote | null = rawVote === null ? null : (rawVote as Vote);

  const db = getFirestoreDb();
  const qRef = db.doc(`aiQuestions/${questionId}`);
  const ratingRef = db.doc(`aiQuestions/${questionId}/ratings/${uid}`);

  try {
    // Read prior vote, then update rating doc + question counters atomically.
    // Voice stats are computed from the same delta and updated outside the
    // transaction (they live on a different doc owned by another writer).
    const { priorVote, likeDelta, dislikeDelta } = await db.runTransaction(async (tx) => {
      const ratingSnap = await tx.get(ratingRef);
      const prior: Vote | null = ratingSnap.exists
        ? ((ratingSnap.data()?.vote as Vote | undefined) ?? null)
        : null;

      const beforeUp = prior === 'up' ? 1 : 0;
      const beforeDown = prior === 'down' ? 1 : 0;
      const afterUp = newVote === 'up' ? 1 : 0;
      const afterDown = newVote === 'down' ? 1 : 0;
      const likeDeltaLocal = afterUp - beforeUp;
      const dislikeDeltaLocal = afterDown - beforeDown;

      // Write rating doc
      if (newVote === null) {
        if (ratingSnap.exists) tx.delete(ratingRef);
      } else {
        // Store uid + questionId as fields too — the doc id is already the
        // uid, but having them as fields lets us do collection-group queries
        // and lets admin tooling display them.
        tx.set(ratingRef, {
          uid,
          questionId,
          vote: newVote,
          ratedAt: FieldValue.serverTimestamp(),
        });
      }

      // Update denormalized counters on the question doc
      const counterUpdates: Record<string, FirebaseFirestore.FieldValue> = {};
      if (likeDeltaLocal !== 0) counterUpdates.likeCount = FieldValue.increment(likeDeltaLocal);
      if (dislikeDeltaLocal !== 0) counterUpdates.dislikeCount = FieldValue.increment(dislikeDeltaLocal);
      if (Object.keys(counterUpdates).length > 0) {
        tx.update(qRef, counterUpdates);
      }

      return { priorVote: prior, likeDelta: likeDeltaLocal, dislikeDelta: dislikeDeltaLocal };
    });

    // Voice stats reflect the user's CURRENT rating choices. Apply the same
    // delta logic so changing a vote (up→down) correctly moves the count
    // from likesGiven to dislikesGiven instead of being stuck at the
    // first vote.
    if (likeDelta !== 0) {
      await incrementVoiceStat(uid, 'likesGiven', likeDelta).catch((err) =>
        console.error('[rate] Failed to update likesGiven:', err)
      );
    }
    if (dislikeDelta !== 0) {
      await incrementVoiceStat(uid, 'dislikesGiven', dislikeDelta).catch((err) =>
        console.error('[rate] Failed to update dislikesGiven:', err)
      );
    }

    return NextResponse.json({ ok: true, priorVote, vote: newVote }, { status: 200 });
  } catch (err) {
    console.error('Failed to rate question:', err);
    return NextResponse.json({ error: 'Failed to rate question.' }, { status: 500 });
  }
}
