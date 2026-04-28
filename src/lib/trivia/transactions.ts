import { FieldValue, Timestamp } from 'firebase-admin/firestore'

import type { TriviaAnswer } from '@/app/trivia/models/trivia'
import { getWeekKey, getYesterdayOf } from '@/lib/dates'
import { getFirestoreDb } from '@/lib/firebase/server'
import { type AuthClaims, getOrCreateProfile } from '@/lib/users/profile'


export interface TriviaProfile {
  gamesPlayed: number
  totalScore: number
  totalCorrect: number
  totalQuestions: number
  currentStreak: number
  bestStreak: number
  lastPlayedDate: string | null
}

interface TriviaWeeklyEntry {
  uid: string
  weekKey: string
  totalScore: number
  gamesPlayed: number
  totalCorrect: number
  totalQuestions: number
  nicknameSnapshot: string
  lastUpdated: Timestamp | FieldValue
}

const EMPTY_TRIVIA_PROFILE: TriviaProfile = {
  gamesPlayed: 0,
  totalScore: 0,
  totalCorrect: 0,
  totalQuestions: 0,
  currentStreak: 0,
  bestStreak: 0,
  lastPlayedDate: null,
}

export interface CompleteGameInput {
  uid: string
  date: string
  score: number
  correct: number
  total: number
  answers: TriviaAnswer[]
  category: { id: number; name: string; icon: string }
}

export interface CompleteGameResult {
  alreadySubmitted: boolean
  profile: TriviaProfile
}

function triviaProfileRef(uid: string) {
  return getFirestoreDb().doc(`users/${uid}/triviaProfile/current`)
}

function triviaGameRef(uid: string, date: string) {
  return getFirestoreDb().doc(`users/${uid}/triviaGames/${date}`)
}

function triviaDailyRef(uid: string, date: string) {
  return getFirestoreDb().doc(`users/${uid}/triviaDaily/${date}`)
}

function triviaWeeklyRef(uid: string, weekKey: string) {
  return getFirestoreDb().doc(`users/${uid}/triviaWeekly/${weekKey}`)
}

function deriveSnapshotName(claims: AuthClaims, nickname: string): string {
  return nickname || claims.name || claims.email || 'Player'
}

export async function recordCompletedGame(
  claims: AuthClaims,
  input: CompleteGameInput
): Promise<CompleteGameResult> {
  if (claims.uid !== input.uid) {
    throw new Error('uid mismatch')
  }

  await getOrCreateProfile(claims)

  const db = getFirestoreDb()
  const userRef = db.doc(`users/${input.uid}`)
  const profileRef = triviaProfileRef(input.uid)
  const gameRef = triviaGameRef(input.uid, input.date)
  const dailyRef = triviaDailyRef(input.uid, input.date)
  const weekKey = getWeekKey(input.date)
  const weeklyRef = triviaWeeklyRef(input.uid, weekKey)

  return db.runTransaction(async (tx) => {
    const [userSnap, profileSnap, gameSnap, weeklySnap] = await Promise.all([
      tx.get(userRef),
      tx.get(profileRef),
      tx.get(gameRef),
      tx.get(weeklyRef),
    ])

    if (gameSnap.exists) {
      const existingProfile = profileSnap.exists
        ? (profileSnap.data() as TriviaProfile)
        : EMPTY_TRIVIA_PROFILE
      return { alreadySubmitted: true, profile: existingProfile }
    }

    const userData = userSnap.data() as { nickname?: string } | undefined
    const nicknameSnapshot = deriveSnapshotName(claims, userData?.nickname ?? '')

    const existing = profileSnap.exists
      ? (profileSnap.data() as TriviaProfile)
      : EMPTY_TRIVIA_PROFILE
    const yesterday = getYesterdayOf(input.date)
    const wasYesterday = existing.lastPlayedDate === yesterday
    const newStreak = wasYesterday ? existing.currentStreak + 1 : 1
    const nextProfile: TriviaProfile = {
      gamesPlayed: existing.gamesPlayed + 1,
      totalScore: existing.totalScore + input.score,
      totalCorrect: existing.totalCorrect + input.correct,
      totalQuestions: existing.totalQuestions + input.total,
      currentStreak: newStreak,
      bestStreak: Math.max(newStreak, existing.bestStreak),
      lastPlayedDate: input.date,
    }

    const existingWeekly = weeklySnap.exists
      ? (weeklySnap.data() as TriviaWeeklyEntry)
      : null
    const nextWeekly: TriviaWeeklyEntry = {
      uid: input.uid,
      weekKey,
      totalScore: (existingWeekly?.totalScore ?? 0) + input.score,
      gamesPlayed: (existingWeekly?.gamesPlayed ?? 0) + 1,
      totalCorrect: (existingWeekly?.totalCorrect ?? 0) + input.correct,
      totalQuestions: (existingWeekly?.totalQuestions ?? 0) + input.total,
      nicknameSnapshot,
      lastUpdated: FieldValue.serverTimestamp(),
    }

    tx.set(gameRef, {
      uid: input.uid,
      date: input.date,
      score: input.score,
      correct: input.correct,
      total: input.total,
      answers: input.answers,
      category: input.category,
      submittedAt: FieldValue.serverTimestamp(),
    })
    tx.set(profileRef, nextProfile)
    tx.set(dailyRef, {
      uid: input.uid,
      date: input.date,
      score: input.score,
      correct: input.correct,
      total: input.total,
      nicknameSnapshot,
      submittedAt: FieldValue.serverTimestamp(),
    })
    tx.set(weeklyRef, nextWeekly)

    return { alreadySubmitted: false, profile: nextProfile }
  })
}
