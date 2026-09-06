/**
 * Firestore access for the Clusters puzzle bank.
 *
 * Documents are keyed by PLAY date, not source date. That freezes the
 * mapping at ingest time, so a later bug in the offset math can never
 * change a puzzle somebody has already played.
 *
 * The collection is server-only in firestore.rules. If the client could
 * read it, the whole server-authoritative design would be decorative.
 */

import { FieldValue } from 'firebase-admin/firestore'

import type { ClusterGroup } from '@/app/clusters/models/clusters'
import { getFirestoreDb } from '@/lib/firebase/server'

const COLLECTION = 'dailyClusters'

export interface ClustersPuzzle {
  /** Play date, equal to the document id. */
  date: string
  /** Ordinal in our sequence. 2026-06-12 is 1. */
  puzzleNumber: number
  /** All 16 words in board order, from the source's `position` field. */
  layout: string[]
  groups: ClusterGroup[]
  source?: { provider: string; date: string; editor: string }
  createdAt?: FirebaseFirestore.Timestamp
}

export type ClustersPuzzleInput = Omit<ClustersPuzzle, 'createdAt'>

function puzzleRef(playDate: string) {
  return getFirestoreDb().collection(COLLECTION).doc(playDate)
}

export async function getPuzzle(playDate: string): Promise<ClustersPuzzle | null> {
  const snap = await puzzleRef(playDate).get()
  if (!snap.exists) return null
  return snap.data() as ClustersPuzzle
}

export async function setPuzzle(puzzle: ClustersPuzzleInput): Promise<void> {
  await puzzleRef(puzzle.date).set({
    ...puzzle,
    createdAt: FieldValue.serverTimestamp(),
  })
}

/**
 * The most recently assigned puzzle, which is where an append-only ingest
 * resumes from. Its `source.date` is the authoritative record of how far
 * through the archive we have read.
 */
export async function getLatestPuzzle(): Promise<ClustersPuzzle | null> {
  const snap = await getFirestoreDb()
    .collection(COLLECTION)
    .orderBy('date', 'desc')
    .limit(1)
    .get()
  if (snap.empty) return null
  return snap.docs[0].data() as ClustersPuzzle
}

/** Which play dates in [start, end] already have a puzzle. Ids only. */
export async function getStoredDates(start: string, end: string): Promise<string[]> {
  const snap = await getFirestoreDb()
    .collection(COLLECTION)
    .where('date', '>=', start)
    .where('date', '<=', end)
    .orderBy('date')
    .select()
    .get()
  return snap.docs.map((doc) => doc.id)
}
