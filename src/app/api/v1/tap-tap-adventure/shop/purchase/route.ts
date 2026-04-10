import { NextRequest, NextResponse } from 'next/server'

import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { Item } from '@/app/tap-tap-adventure/models/item'

export async function POST(req: NextRequest) {
  try {
    const { character, itemId, price } = (await req.json()) as {
      character: FantasyCharacter
      itemId: string
      price: number
    }

    if (!character || !itemId || price == null) {
      return NextResponse.json({ error: 'character, itemId, and price are required' }, { status: 400 })
    }

    if (character.gold < price) {
      return NextResponse.json({ error: 'Not enough gold' }, { status: 400 })
    }

    const updatedCharacter: FantasyCharacter = {
      ...character,
      gold: character.gold - price,
    }

    const purchasedItem: Item = {
      id: itemId,
      name: '',
      description: '',
      quantity: 1,
    }

    return NextResponse.json({ updatedCharacter, purchasedItem })
  } catch (err) {
    console.error('Error purchasing item', err)
    return NextResponse.json(
      { error: 'Failed to purchase item', details: (err as Error).message },
      { status: 500 }
    )
  }
}
