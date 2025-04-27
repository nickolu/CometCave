import { NextRequest } from 'next/server';
import { moveForwardController } from './controllers/moveForwardController';

export async function POST(req: NextRequest) {
  return moveForwardController(req);
}
