import { type NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';

import { verifyRequestAuth } from '@/lib/api/auth';
import { getFirestoreDb } from '@/lib/firebase/server';

const FLAG_THRESHOLD = 3;
const VALID_REASONS = ['wrong_answer', 'ambiguous', 'inappropriate', 'other'] as const;
type FlagReason = (typeof VALID_REASONS)[number];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyRequestAuth(request);
  if ('error' in auth) return auth.error;

  const { id: questionId } = await params;
  const uid = auth.claims.uid;

  let body: { reason?: unknown; note?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { reason, note } = body;

  if (!VALID_REASONS.includes(reason as FlagReason)) {
    return NextResponse.json(
      { error: 'Invalid reason. Must be one of: wrong_answer, ambiguous, inappropriate, other.' },
      { status: 400 }
    );
  }

  if (note !== undefined && (typeof note !== 'string' || note.length > 500)) {
    return NextResponse.json({ error: 'Note must be a string of max 500 characters.' }, { status: 400 });
  }

  const db = getFirestoreDb();
  const qRef = db.doc(`aiQuestions/${questionId}`);
  const flagRef = db.doc(`aiQuestions/${questionId}/flags/${uid}`);

  try {
    await db.runTransaction(async (tx) => {
      const qSnap = await tx.get(qRef);
      if (!qSnap.exists) throw new Error('Question not found');

      const qData = qSnap.data()!;
      const newFlaggedCount = (qData.flaggedCount ?? 0) + 1;

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
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message === 'Question not found') {
      return NextResponse.json({ error: 'Question not found.' }, { status: 404 });
    }
    console.error('Failed to flag question:', err);
    return NextResponse.json({ error: 'Failed to flag question.' }, { status: 500 });
  }
}
