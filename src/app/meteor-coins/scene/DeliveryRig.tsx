'use client'

import { CannonDelivery } from '@/app/meteor-coins/lib/deliveries/cannon'
import { SlideDelivery } from '@/app/meteor-coins/lib/deliveries/slide'
import type { DropGame } from '@/app/meteor-coins/lib/game'
import { CannonRig } from '@/app/meteor-coins/scene/CannonRig'
import { SlideRig } from '@/app/meteor-coins/scene/SlideRig'

/**
 * Draws the stage's delivery. The arm is drawn by Scene itself, with the
 * coins it holds; every other delivery has a rig here, picked by its kind.
 * A rig reads its delivery every frame and owns no game state.
 */
export function DeliveryRig({ game }: { game: DropGame }) {
  const delivery = game.delivery
  if (delivery instanceof CannonDelivery) return <CannonRig game={game} cannon={delivery} />
  if (delivery instanceof SlideDelivery) return <SlideRig game={game} slide={delivery} />
  return null
}
