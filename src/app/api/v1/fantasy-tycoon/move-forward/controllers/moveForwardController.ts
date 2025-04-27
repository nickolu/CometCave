import { NextRequest, NextResponse } from 'next/server';
import { MoveForwardRequestSchema } from '../schemas';
import { moveForwardService } from '../services/moveForwardService';


// Handles both success (MoveForwardResponse) and error (error object) responses
export async function moveForwardController(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const parseResult = MoveForwardRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid request', details: parseResult.error }, { status: 400 }); // error object, not MoveForwardResponse
    }
    const { character } = parseResult.data;
    const result = await moveForwardService(character);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Error in moveForwardController', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); // error object, not MoveForwardResponse
  }
}
