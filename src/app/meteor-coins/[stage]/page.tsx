import { notFound } from 'next/navigation'

import { STAGES, playableStage } from '@/app/meteor-coins/lib/stages'
import StageApp from '@/app/meteor-coins/StageApp'

import type { Metadata } from 'next'

type Params = Promise<{ stage: string }>

export function generateStaticParams() {
  return STAGES.filter(s => s.playable).map(s => ({ stage: s.slug }))
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const stage = playableStage((await params).stage)
  if (!stage) return { title: 'Meteor Coins — CometCave' }
  return {
    title: `${stage.name} — Meteor Coins — CometCave`,
    description: `Stage ${stage.number} of Meteor Coins. ${stage.pitch}`,
  }
}

/**
 * A stage plays straight from its link, locked or not, so a shared score
 * drops a visitor directly into play. Unbuilt stages are a 404.
 */
export default async function MeteorCoinsStagePage({ params }: { params: Params }) {
  const stage = playableStage((await params).stage)
  if (!stage) notFound()
  return <StageApp slug={stage.slug} />
}
