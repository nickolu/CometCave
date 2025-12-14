import { NextResponse } from 'next/server'
import { isImageGenerationAllowed, getImageGenerationDisableReason } from '@/lib/utils'

export async function GET() {
  const allowed = isImageGenerationAllowed()
  return NextResponse.json({
    allowed,
    disableReason: allowed ? null : getImageGenerationDisableReason(),
  })
}
