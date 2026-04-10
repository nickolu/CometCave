import { NextRequest, NextResponse } from 'next/server'

import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { calculateSellPrice } from '@/app/tap-tap-adventure/lib/sellPrice'

export async function POST(req: NextRequest) {
  try {
    const { character, itemId } = (await req.json()) as {
      character: FantasyCharacter
      itemId: string
    }

    if (!character || !itemId) {
      return NextResponse.json({ error: 'character and itemId are required' }, { status: 400 })
    }

    const itemIndex = character.inventory.findIndex(i => i.id === itemId)
    if (itemIndex === -1) {
      return NextResponse.json({ error: 'Item not found in inventory' }, { status: 404 })
    }

    const item = character.inventory[itemIndex]
    const goldEarned = calculateSellPrice(item)

    // Build updated inventory: decrement quantity or mark deleted
    const updatedInventory = character.inventory.map((inv, idx) => {
      if (idx !== itemIndex) return inv
      if (inv.quantity > 1) {
        return { ...inv, quantity: inv.quantity - 1 }
      }
      return { ...inv, quantity: 0, status: 'deleted' as const }
    }).filter(inv => inv.status !== 'deleted')

    const updatedCharacter: FantasyCharacter = {
      ...character,
      gold: character.gold + goldEarned,
      inventory: updatedInventory,
    }

    return NextResponse.json({ updatedCharacter, goldEarned })
  } catch (err) {
    console.error('Error selling item', err)
    return NextResponse.json(
      { error: 'Failed to sell item', details: (err as Error).message },
      { status: 500 }
    )
  }
}
