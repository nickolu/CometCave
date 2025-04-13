'use server';

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { message } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request: message is required and must be a string' },
        { status: 400 }
      );
    }

    // Basic safety checks
    const containsProfanity = /\b(fuck|shit|ass|bitch|dick|pussy|cunt)\b/i.test(message);
    const containsHate = /\b(nigger|faggot|retard|spic|kike|chink)\b/i.test(message);
    const containsPersonalInfo = /\b(\d{3}[-.]?\d{3}[-.]?\d{4}|\d{16}|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/i.test(message);

    if (containsProfanity || containsHate || containsPersonalInfo) {
      const reasons = [
        containsProfanity && 'Message contains profanity',
        containsHate && 'Message contains hate speech',
        containsPersonalInfo && 'Message contains personal information'
      ].filter(Boolean);

      return NextResponse.json({
        safe: false,
        reason: reasons.join(', ')
      });
    }

    return NextResponse.json({
      safe: true,
      reason: 'Message passed all safety checks'
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
