/**
 * The server owns the run. The client is an optimistic mirror.
 *
 * Every guess goes through one Firestore transaction that reads the
 * session, scores the guess, and — if that guess ends the run — writes the
 * game record and folds the result into the profile in the same atomic
 * step. There is no second write to lose and no window where a run is
 * finished but unrecorded.
 */

import { FieldValue, type Timestamp } from 'firebase-admin/firestore'

import {
  type ClusterGroup,
  type ClustersProfile,
  type ClustersSessionState,
  GROUP_SIZE,
  type GuessRecord,
  type GuessResponse,
  MAX_MISTAKES,
  type SessionStatus,
  type SolvedGroup,
  TIERS,
} from '@/app/clusters/models/clusters'
import { getFirestoreDb } from '@/lib/firebase/server'
import type { AuthClaims } from '@/lib/users/profile'

import { applyResult, normalizeProfile } from './profile'
import { type GuessRejection, evaluateGuess, guessKey, validateGuess } from './scoring'

import type { ClustersPuzzle } from './puzzleDb'

export interface ClustersSessionDoc {
  date: string
  status: SessionStatus
  solved: SolvedGroup[]
  mistakes: number
  guesses: GuessRecord[]
  countsForStreak: boolean
  startedAt?: Timestamp
  finishedAt?: Timestamp
}

function sessionRef(uid: string, date: string) {
  return getFirestoreDb().doc(`users/${uid}/clustersSessions/${date}`)
}
function profileRef(uid: string) {
  return getFirestoreDb().doc(`users/${uid}/clustersProfile/current`)
}
function gameRef(uid: string, date: string) {
  return getFirestoreDb().doc(`users/${uid}/clustersGames/${date}`)
}

function emptySession(date: string, countsForStreak: boolean): ClustersSessionDoc {
  return { date, status: 'in_progress', solved: [], mistakes: 0, guesses: [], countsForStreak }
}

/**
 * The stored fields, without the timestamps.
 *
 * Spreading a normalized session straight into `tx.set` would carry
 * `startedAt: undefined` / `finishedAt: undefined` for a run still in
 * progress, and Firestore rejects undefined values outright. Every write
 * builds its payload from here and adds the timestamps it actually means.
 */
function sessionPayload(session: ClustersSessionDoc) {
  return {
    date: session.date,
    status: session.status,
    solved: session.solved,
    mistakes: session.mistakes,
    guesses: session.guesses,
    countsForStreak: session.countsForStreak,
  }
}

function normalizeSession(
  raw: FirebaseFirestore.DocumentData | undefined,
  date: string
): ClustersSessionDoc | null {
  if (!raw) return null
  return {
    date,
    status: (raw.status as SessionStatus) ?? 'in_progress',
    solved: Array.isArray(raw.solved) ? (raw.solved as SolvedGroup[]) : [],
    mistakes: typeof raw.mistakes === 'number' ? raw.mistakes : 0,
    guesses: Array.isArray(raw.guesses) ? (raw.guesses as GuessRecord[]) : [],
    countsForStreak: raw.countsForStreak === true,
    startedAt: raw.startedAt as Timestamp | undefined,
    finishedAt: raw.finishedAt as Timestamp | undefined,
  }
}

/** The part of a session the player is allowed to see. */
export function toClientState(session: ClustersSessionDoc): ClustersSessionState {
  return {
    status: session.status,
    mistakes: session.mistakes,
    solved: session.solved,
    guesses: session.guesses,
  }
}

export async function readSession(uid: string, date: string): Promise<ClustersSessionDoc | null> {
  const snap = await sessionRef(uid, date).get()
  return normalizeSession(snap.data(), date)
}

export async function readProfile(uid: string): Promise<ClustersProfile> {
  const snap = await profileRef(uid).get()
  return normalizeProfile(snap.data() as Partial<ClustersProfile> | undefined)
}

/** Words belonging to groups already solved, so they can leave the board. */
function solvedWordsOf(session: ClustersSessionDoc): string[] {
  return session.solved.flatMap((g) => g.words)
}

/** Purple was the first group solved. The flex, and it is counted. */
export function isPurpleFirst(solved: SolvedGroup[]): boolean {
  return solved.length > 0 && solved[0].tier === 'purple'
}

export interface SubmitGuessInput {
  claims: AuthClaims
  puzzle: ClustersPuzzle
  words: string[]
  guessId: string
  /** Today in Pacific, for freezing `countsForStreak` on a fresh session. */
  today: string
}

export type SubmitGuessResult =
  | { ok: true; response: GuessResponse }
  | { ok: false; rejection: GuessRejection | 'finished' }

/**
 * Replay a guess we have already recorded, reconstructing what the player
 * saw at the time from the history itself. Mobile networks retry, and a
 * phantom mistake in a game you get one shot at per day is unforgivable.
 */
function replay(
  session: ClustersSessionDoc,
  puzzle: ClustersPuzzle,
  guessId: string,
  profile: ClustersProfile
): GuessResponse {
  const index = session.guesses.findIndex((g) => g.guessId === guessId)
  const record = session.guesses[index]
  const mistakesAtThatPoint = session.guesses
    .slice(0, index + 1)
    .filter((g) => g.result === 'wrong' || g.result === 'one-away').length

  // A correct guess named a group; find it by its word-set.
  const group =
    record.result === 'correct'
      ? puzzle.groups.find((g) => guessKey(g.words) === guessKey(record.words))
      : undefined

  const terminal = session.status !== 'in_progress'
  return {
    result: record.result,
    ...(group ? { group } : {}),
    mistakesLeft: Math.max(0, MAX_MISTAKES - mistakesAtThatPoint),
    status: session.status,
    ...(terminal ? { solution: puzzle.groups, profile } : {}),
  }
}

export async function submitGuess(input: SubmitGuessInput): Promise<SubmitGuessResult> {
  const { claims, puzzle, words, guessId, today } = input
  const uid = claims.uid
  const db = getFirestoreDb()

  const sRef = sessionRef(uid, puzzle.date)
  const pRef = profileRef(uid)
  const gRef = gameRef(uid, puzzle.date)

  return db.runTransaction<SubmitGuessResult>(async (tx) => {
    // All reads before any write — Firestore requires it.
    const [sessionSnap, profileSnap] = await Promise.all([tx.get(sRef), tx.get(pRef)])

    const stored = normalizeSession(sessionSnap.data(), puzzle.date)
    const profile = normalizeProfile(profileSnap.data() as Partial<ClustersProfile> | undefined)

    // A session is created by the first guess, not by loading the board.
    // That keeps `countsForStreak` honest for the player who starts before
    // midnight and finishes after it, without littering Firestore with a
    // session doc for every page view.
    const session = stored ?? emptySession(puzzle.date, puzzle.date === today)

    if (session.guesses.some((g) => g.guessId === guessId)) {
      return { ok: true, response: replay(session, puzzle, guessId, profile) }
    }

    if (session.status !== 'in_progress') {
      return { ok: false, rejection: 'finished' }
    }

    const rejection = validateGuess(puzzle.layout, words, solvedWordsOf(session))
    if (rejection) return { ok: false, rejection }

    const outcome = evaluateGuess(
      puzzle.groups,
      words,
      session.solved.map((g) => g.tier),
      session.guesses
    )

    const guessIndex = session.guesses.length
    const guesses: GuessRecord[] = [
      ...session.guesses,
      { words: words.map((w) => w.toUpperCase()), result: outcome.result, guessId },
    ]

    // A duplicate is an accident, not a play: recorded, but nothing moves.
    if (outcome.result === 'duplicate') {
      tx.set(
        sRef,
        {
          ...sessionPayload(session),
          guesses,
          startedAt: session.startedAt ?? FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      return {
        ok: true,
        response: {
          result: 'duplicate',
          mistakesLeft: MAX_MISTAKES - session.mistakes,
          status: session.status,
        },
      }
    }

    const solved: SolvedGroup[] = [...session.solved]
    if (outcome.result === 'correct' && outcome.group) {
      solved.push({ ...outcome.group, guessIndex })

      // Three solved leaves the fourth group forced. Resolve it rather than
      // making the player click a foregone conclusion.
      if (solved.length === TIERS.length - 1) {
        const done = new Set(solved.map((g) => g.tier))
        const last = puzzle.groups.find((g) => !done.has(g.tier))
        if (last) solved.push({ ...last, guessIndex })
      }
    }

    const mistakes = session.mistakes + outcome.mistakeDelta
    const status: SessionStatus =
      solved.length === TIERS.length ? 'won' : mistakes >= MAX_MISTAKES ? 'lost' : 'in_progress'

    const next: ClustersSessionDoc = { ...session, solved, mistakes, guesses, status }

    const response: GuessResponse = {
      result: outcome.result,
      ...(outcome.group ? { group: outcome.group } : {}),
      mistakesLeft: Math.max(0, MAX_MISTAKES - mistakes),
      status,
    }

    if (status === 'in_progress') {
      tx.set(
        sRef,
        {
          ...sessionPayload(next),
          startedAt: session.startedAt ?? FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      return { ok: true, response }
    }

    // Terminal. Session, game record and profile all move together.
    const purpleFirst = isPurpleFirst(solved)
    const nextProfile = applyResult(profile, {
      date: puzzle.date,
      mistakes,
      won: status === 'won',
      purpleFirst,
      countsForStreak: session.countsForStreak,
    })

    tx.set(
      sRef,
      {
        ...sessionPayload(next),
        startedAt: session.startedAt ?? FieldValue.serverTimestamp(),
        finishedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    tx.set(gRef, {
      date: puzzle.date,
      puzzleNumber: puzzle.puzzleNumber,
      status,
      mistakes,
      solved,
      guesses,
      purpleFirst,
      countsForStreak: session.countsForStreak,
      groups: puzzle.groups,
      playedAt: FieldValue.serverTimestamp(),
    })
    tx.set(pRef, { ...nextProfile, updatedAt: FieldValue.serverTimestamp() }, { merge: true })

    return {
      ok: true,
      response: { ...response, solution: puzzle.groups, profile: nextProfile },
    }
  })
}

/** The four words of every group, for revealing a lost board. */
export function remainingGroups(
  puzzle: ClustersPuzzle,
  solved: SolvedGroup[]
): ClusterGroup[] {
  const done = new Set(solved.map((g) => g.tier))
  return puzzle.groups.filter((g) => !done.has(g.tier))
}

export const GUESS_WORD_COUNT = GROUP_SIZE
