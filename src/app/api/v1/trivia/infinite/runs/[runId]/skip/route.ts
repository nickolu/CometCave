import { type NextRequest, NextResponse } from 'next/server';

import { verifyRequestAuth } from '@/lib/api/auth';
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
    await recordSkip(auth.claims.uid, runId, questionId ?? '');
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error('Failed to record skip:', err);
    return NextResponse.json({ error: 'Failed to record skip.' }, { status: 500 });
  }
}
