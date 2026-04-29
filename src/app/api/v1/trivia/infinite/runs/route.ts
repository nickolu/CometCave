import { type NextRequest, NextResponse } from 'next/server';

import { verifyRequestAuth } from '@/lib/api/auth';
import { startRun } from '@/lib/trivia/infiniteRuns';
import { CATEGORY_META } from '@/lib/trivia/categories';

export async function POST(request: NextRequest) {
  const auth = await verifyRequestAuth(request);
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();
    const mode = body.mode === 'practice' ? 'practice' : 'scored';

    // Parse and validate optional categoryId
    let categoryId: number | undefined
    if (body.categoryId !== undefined && body.categoryId !== null) {
      const parsed = Number(body.categoryId)
      if (!isNaN(parsed) && parsed in CATEGORY_META) {
        categoryId = parsed
      }
    }

    const result = await startRun(auth.claims.uid, mode, categoryId);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error('Failed to start infinite run:', err);
    return NextResponse.json({ error: 'Failed to start run.' }, { status: 500 });
  }
}
