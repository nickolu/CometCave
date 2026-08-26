import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getRunByIdPublic } from '@/lib/trivia/infiniteRuns'
import { CATEGORY_META } from '@/lib/trivia/categories'
import { RunSharePage } from './RunSharePage'

interface PageProps {
  params: Promise<{ runId: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { runId } = await params
  const result = await getRunByIdPublic(runId)
  if (!result) return { title: 'Run Not Found — CometCave' }
  const { run } = result
  const title = `🔥 ${run.longestStreak} Streak — CometCave Infinite Trivia`
  const description = `Score: ${run.score.toLocaleString()} · ${run.answers.length} questions answered`
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [`/api/v1/trivia/infinite/runs/${runId}/share-image`],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`/api/v1/trivia/infinite/runs/${runId}/share-image`],
    },
  }
}

export default async function Page({ params }: PageProps) {
  const { runId } = await params
  const result = await getRunByIdPublic(runId)
  if (!result) notFound()
  const { run } = result

  let categoryLabel = ''
  if (run.customCategory) {
    categoryLabel = run.customCategory
  } else if (run.categoryFilters && run.categoryFilters.length === 1) {
    categoryLabel = CATEGORY_META[run.categoryFilters[0]]?.name ?? ''
  } else if (run.categoryFilters && run.categoryFilters.length > 1) {
    categoryLabel = `${run.categoryFilters.length} Categories`
  }

  return <RunSharePage run={{
    runId,
    longestStreak: run.longestStreak,
    score: run.score,
    questionsAnswered: run.answers.length,
    trailblazes: run.trailblazes,
    mode: run.mode,
    categoryLabel,
  }} />
}
