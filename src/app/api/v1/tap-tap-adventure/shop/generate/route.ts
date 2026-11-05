import { NextRequest, NextResponse } from 'next/server'

import { generateShopItems, generateShopMount } from '@/app/tap-tap-adventure/lib/shopGenerator'
import { requireAiAccess } from '@/lib/api/ai-gate'

export async function POST(req: NextRequest) {
  const gate = await requireAiAccess(req, 'tap-tap-text')
  if ('error' in gate) return gate.error

  try {
    const { character, townName, townDescription } = await req.json()
    if (!character) {
      return NextResponse.json({ error: 'Character is required' }, { status: 400 })
    }

    const shopItems = await generateShopItems(character, townName, townDescription)
    const shopMount = generateShopMount(character)
    return NextResponse.json({ shopItems, shopMount })
  } catch (err) {
    console.error('Error generating shop', err)
    return NextResponse.json(
      { error: 'Failed to generate shop' },
      { status: 500 }
    )
  }
}
