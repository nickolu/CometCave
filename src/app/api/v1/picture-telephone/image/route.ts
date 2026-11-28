import { handleImage } from '@/lib/picture-telephone/server/handlers'
import { realDeps } from '@/lib/picture-telephone/server/real-deps'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(request: Request) {
  return handleImage(request, realDeps())
}
