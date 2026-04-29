import { type NextRequest, NextResponse } from 'next/server';

import { verifyRequestAuth } from '@/lib/api/auth';
import { endRun } from '@/lib/trivia/infiniteRuns';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const auth = await verifyRequestAuth(request);
  if ('error' in auth) return auth.error;

  const { runId } = await params;

  try {
    await endRun(auth.claims.uid, runId);
    return NextResponse.json({ ended: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'Run not found') {
      return NextResponse.json({ error: 'Run not found.' }, { status: 404 });
    }
    console.error('Failed to end run:', err);
    return NextResponse.json({ error: 'Failed to end run.' }, { status: 500 });
  }
}
