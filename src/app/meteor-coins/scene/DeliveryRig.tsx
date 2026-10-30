'use client'

import { useFrame } from '@react-three/fiber'
import { useState } from 'react'

import { BeltDelivery } from '@/app/meteor-coins/lib/deliveries/belt'
import { BowlingDelivery } from '@/app/meteor-coins/lib/deliveries/bowling'
import { CannonDelivery } from '@/app/meteor-coins/lib/deliveries/cannon'
import { CraneDelivery } from '@/app/meteor-coins/lib/deliveries/crane'
import { OwlsDelivery } from '@/app/meteor-coins/lib/deliveries/owls'
import { PhasedDelivery } from '@/app/meteor-coins/lib/deliveries/phased'
import { PlungerDelivery } from '@/app/meteor-coins/lib/deliveries/plunger'
import { SlideDelivery } from '@/app/meteor-coins/lib/deliveries/slide'
import { SpiderDelivery } from '@/app/meteor-coins/lib/deliveries/spider'
import { SwitchesDelivery } from '@/app/meteor-coins/lib/deliveries/switches'
import type { Delivery } from '@/app/meteor-coins/lib/deliveries/types'
import type { DropGame } from '@/app/meteor-coins/lib/game'
import { BeltRig } from '@/app/meteor-coins/scene/BeltRig'
import { BowlingRig } from '@/app/meteor-coins/scene/BowlingRig'
import { CannonRig } from '@/app/meteor-coins/scene/CannonRig'
import { CraneRig } from '@/app/meteor-coins/scene/CraneRig'
import { OwlRig } from '@/app/meteor-coins/scene/OwlRig'
import { PlungerRig } from '@/app/meteor-coins/scene/PlungerRig'
import { SlideRig } from '@/app/meteor-coins/scene/SlideRig'
import { SpiderRig } from '@/app/meteor-coins/scene/SpiderRig'
import { SwitchesRig } from '@/app/meteor-coins/scene/SwitchesRig'

/**
 * Draws the stage's delivery. The arm is drawn by Scene itself, with the
 * coins it holds; every other delivery has a rig here, picked by its kind.
 * A rig reads its delivery every frame and owns no game state.
 */
export function DeliveryRig({ game }: { game: DropGame }) {
  return <RigFor game={game} delivery={game.delivery} />
}

function RigFor({ game, delivery }: { game: DropGame; delivery: Delivery }) {
  if (delivery instanceof CannonDelivery) return <CannonRig game={game} cannon={delivery} />
  if (delivery instanceof SwitchesDelivery) return <SwitchesRig game={game} switches={delivery} />
  if (delivery instanceof OwlsDelivery) return <OwlRig game={game} owls={delivery} />
  if (delivery instanceof PlungerDelivery) return <PlungerRig game={game} plunger={delivery} />
  if (delivery instanceof CraneDelivery) return <CraneRig game={game} crane={delivery} />
  if (delivery instanceof BeltDelivery) return <BeltRig game={game} belt={delivery} />
  if (delivery instanceof SpiderDelivery) return <SpiderRig game={game} spider={delivery} />
  if (delivery instanceof SlideDelivery) return <SlideRig game={game} slide={delivery} />
  if (delivery instanceof PhasedDelivery) return <PhasedRig game={game} phased={delivery} />
  if (delivery instanceof BowlingDelivery) return <BowlingRig game={game} lanes={delivery} />
  return null
}

/** A delivery that changes with the phase: only the one in use is drawn. */
function PhasedRig({ game, phased }: { game: DropGame; phased: PhasedDelivery }) {
  const [active, setActive] = useState(() => phased.active)
  useFrame(() => {
    if (phased.active !== active) setActive(phased.active)
  })
  return <RigFor key={phased.phases.indexOf(active)} game={game} delivery={active} />
}
