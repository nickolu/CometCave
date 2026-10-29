'use client'

import { BeltDelivery } from '@/app/meteor-coins/lib/deliveries/belt'
import { CannonDelivery } from '@/app/meteor-coins/lib/deliveries/cannon'
import { CraneDelivery } from '@/app/meteor-coins/lib/deliveries/crane'
import { PlungerDelivery } from '@/app/meteor-coins/lib/deliveries/plunger'
import { SlideDelivery } from '@/app/meteor-coins/lib/deliveries/slide'
import { SpiderDelivery } from '@/app/meteor-coins/lib/deliveries/spider'
import type { DropGame } from '@/app/meteor-coins/lib/game'
import { BeltRig } from '@/app/meteor-coins/scene/BeltRig'
import { CannonRig } from '@/app/meteor-coins/scene/CannonRig'
import { CraneRig } from '@/app/meteor-coins/scene/CraneRig'
import { PlungerRig } from '@/app/meteor-coins/scene/PlungerRig'
import { SlideRig } from '@/app/meteor-coins/scene/SlideRig'
import { SpiderRig } from '@/app/meteor-coins/scene/SpiderRig'

/**
 * Draws the stage's delivery. The arm is drawn by Scene itself, with the
 * coins it holds; every other delivery has a rig here, picked by its kind.
 * A rig reads its delivery every frame and owns no game state.
 */
export function DeliveryRig({ game }: { game: DropGame }) {
  const delivery = game.delivery
  if (delivery instanceof CannonDelivery) return <CannonRig game={game} cannon={delivery} />
  if (delivery instanceof PlungerDelivery) return <PlungerRig game={game} plunger={delivery} />
  if (delivery instanceof CraneDelivery) return <CraneRig game={game} crane={delivery} />
  if (delivery instanceof BeltDelivery) return <BeltRig game={game} belt={delivery} />
  if (delivery instanceof SpiderDelivery) return <SpiderRig game={game} spider={delivery} />
  if (delivery instanceof SlideDelivery) return <SlideRig game={game} slide={delivery} />
  return null
}
