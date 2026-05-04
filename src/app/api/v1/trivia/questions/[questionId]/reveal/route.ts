import { FieldValue } from 'firebase-admin/firestore'
import { type NextRequest, NextResponse } from 'next/server'

import { verifyRequestAuth } from '@/lib/api/auth'
import { getFirestoreDb } from '@/lib/firebase/server'
import { buildMarkSeenWrite } from '@/lib/trivia/triviaState'

// POST /api/v1/trivia/questions/{questionId}/reveal
// Marks a question as "seen" so it won't appear in future infinite trivia runs.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  const auth = await verifyRequestAuth(request)
  if ('error' in auth) return auth.error

  const { questionId } = await params
  const uid = auth.claims.uid

  const db = getFirestoreDb()
  const seenRef = db.doc(`users/${uid}/seenQuestions/${questionId}`)

  try {
    await seenRef.set(
      {
        at: FieldValue.serverTimestamp(),
        correct: false,
        source: 'explorer',
      },
      { merge: true }
    )

    const markSeen = buildMarkSeenWrite(uid, questionId)
    await markSeen.ref.set(markSeen.data, { merge: true })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err) {
    console.error('[reveal] Failed to mark question as seen:', err)
    return NextResponse.json({ error: 'Failed to mark question as seen.' }, { status: 500 })
  }
}
