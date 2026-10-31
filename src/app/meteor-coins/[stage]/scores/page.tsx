import { notFound } from 'next/navigation'

import { STAGES, playableStage } from '@/app/meteor-coins/lib/stages'

import StageScores from './StageScores'

import type { Metadata } from 'next'

type Params = Promise<{ stage: string }>

export function generateStaticParams() {
  return STAGES.filter(s => s.playable).map(s => ({ stage: s.slug }))
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const stage = playableStage((await params).stage)
  if (!stage) return { title: 'Meteor Coins — CometCave' }
  return {
    title: `${stage.name} scores — Meteor Coins — CometCave`,
    description: `Best scores on stage ${stage.number} of Meteor Coins, ${stage.name}.`,
  }
}

/** The scores for one stage. Unbuilt stages are a 404. */
export default async function MeteorCoinsScoresPage({ params }: { params: Params }) {
  const stage = playableStage((await params).stage)
  if (!stage) notFound()
  return <StageScores slug={stage.slug} />
}
