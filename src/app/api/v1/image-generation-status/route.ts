import { NextResponse } from 'next/server'

import { isMockMode } from '@/lib/picture-telephone/safety/mock-mode'
import { getImageGenerationDisableReason, isImageGenerationAllowed } from '@/lib/utils'

export async function GET() {
  const allowed = isImageGenerationAllowed()
  return NextResponse.json({
    allowed,
    disableReason: allowed ? null : getImageGenerationDisableReason(),
    // Picture Telephone can serve placeholder pictures without the flag (never in production).
    pictureTelephoneMock: isMockMode(),
  })
}
