import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getFirestoreDb } from '@/lib/firebase/server'
import { getDailyCategory } from '@/lib/trivia/categories'
import { DailySharePage } from './DailySharePage'

interface PageProps {
  params: Promise<{ date: string; uid: string }>
}

async function getDailyResult(date: string, uid: string) {
  const db = getFirestoreDb()
  const snap = await db.doc(`users/${uid}/triviaGames/${date}`).get()
  if (!snap.exists) return null
  const data = snap.data()!
  const userSnap = await db.doc(`users/${uid}`).get()
  const nickname = userSnap.exists ? (userSnap.data()?.nickname ?? '') : ''
  const grid = Array.isArray(data.answers)
    ? data.answers.map((a: { correct: boolean }) => (a.correct ? '🟩' : '🟥')).join('')
    : ''
  return {
    date: data.date as string,
    score: data.score as number,
    correct: data.correct as number,
    total: data.total as number,
    grid,
    category: data.category as { id: number; name: string; icon: string } | null,
    nickname,
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { date, uid } = await params
  const result = await getDailyResult(date, uid)
  if (!result) return { title: 'Result Not Found — CometCave' }
  const category = result.category ?? getDailyCategory(date)
  const displayDate = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const title = `${category.icon} ${result.correct}/${result.total} — CometCave Daily Trivia`
  const description = `Score: ${result.score.toLocaleString()} · ${displayDate} · ${category.name}`
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: 'summary', title, description },
  }
}

export default async function Page({ params }: PageProps) {
  const { date, uid } = await params
  const result = await getDailyResult(date, uid)
  if (!result) notFound()
  return <DailySharePage result={result} />
}
