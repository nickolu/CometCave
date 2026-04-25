import { NextRequest, NextResponse } from 'next/server'

import { generateShopItems, generateShopMount } from '@/app/tap-tap-adventure/lib/shopGenerator'

export async function POST(req: NextRequest) {
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
      { error: 'Failed to generate shop', details: (err as Error).message },
      { status: 500 }
    )
  }
}
