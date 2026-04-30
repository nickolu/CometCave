import { type NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';

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

  const { vote } = body;

  if (vote !== null && !VALID_VOTES.includes(vote as Vote)) {
    return NextResponse.json(
      { error: 'Invalid vote. Must be "up", "down", or null.' },
      { status: 400 }
    );
  }

  const db = getFirestoreDb();
  const ratingRef = db.doc(`aiQuestions/${questionId}/ratings/${uid}`);

  try {
    const existingSnap = await ratingRef.get();
    const hadPriorVote = existingSnap.exists;

    if (vote === null) {
      await ratingRef.delete();
    } else {
      await ratingRef.set({
        vote,
        ratedAt: FieldValue.serverTimestamp(),
      });

      // Only increment lifetime counter for new votes (not updates)
      if (!hadPriorVote) {
        const field = vote === 'up' ? 'likesGiven' : 'dislikesGiven';
        await incrementVoiceStat(uid, field).catch((err) =>
          console.error('[rate] Failed to increment voice stat:', err)
        );
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error('Failed to rate question:', err);
    return NextResponse.json({ error: 'Failed to rate question.' }, { status: 500 });
  }
}
