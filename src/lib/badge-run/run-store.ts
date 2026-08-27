/**
 * Badge Run — Firestore read/write paths for run records and leaderboard.
 *
 * Firestore layout:
 *   badge-run-runs/{YYYYMMDD}_{uid}    one run per player per UTC day
 *   badge-run-leaderboard/{YYYYMMDD}   top-100 entries for the day
 *
 * Both collections use a single JSON blob per document (same house pattern as
 * dicebound/campaign-store) — runs are saved and read whole, never queried by
 * nested field. Indexable scalars (date, uid, badgesEarned) sit at the top level
 * so the leaderboard query and ghost selection work without deep indexing.
 */
import { FieldValue } from 'firebase-admin/firestore'

import {
  type RunRecord,
  type LeaderboardDocument,
  type LeaderboardEntry,
  runDocId,
  validateRunRecord,
} from '@/app/badge-run/domain/run-record'
import { getFirestoreDb } from '@/lib/firebase/server'

const RUNS_COLLECTION = 'badge-run-runs'
const LEADERBOARD_COLLECTION = 'badge-run-leaderboard'
const MAX_LEADERBOARD_ENTRIES = 100

function runsRef() {
  return getFirestoreDb().collection(RUNS_COLLECTION)
}

function leaderboardRef() {
  return getFirestoreDb().collection(LEADERBOARD_COLLECTION)
}

// ---------------------------------------------------------------------------
// Run records
// ---------------------------------------------------------------------------

/**
 * Fetch today's run for a specific player.
 * Returns null if the player hasn't completed a run today.
 */
export async function loadRunRecord(date: string, uid: string): Promise<RunRecord | null> {
  const docId = runDocId(date, uid)
  const snap = await runsRef().doc(docId).get()
  if (!snap.exists) return null
  return validateRunRecord({ ...snap.data(), id: docId })
}

/**
 * Save a completed run.
 * One run per player per day — second write overwrites the first (allows replay).
 * Also updates the daily leaderboard.
 */
export async function saveRunRecord(record: RunRecord): Promise<void> {
  const docId = runDocId(record.date, record.uid)
  const db = getFirestoreDb()

  // Write the run record
  await runsRef().doc(docId).set({
    ...record,
    id: docId,
    savedAt: FieldValue.serverTimestamp(),
  })

  // Update the leaderboard
  await updateLeaderboard(record, db)
}

/**
 * Fetch N ghost records for a given date and seed.
 * Used to populate the ghost rival lobby.
 * Ordered by badgesEarned desc; ghosts that went further make better rivals.
 */
export async function loadGhostRecords(date: string, seed: number, limit = 8): Promise<RunRecord[]> {
  const snap = await runsRef()
    .where('date', '==', date)
    .where('seed', '==', seed)
    .orderBy('badgesEarned', 'desc')
    .limit(limit)
    .get()

  return snap.docs
    .map(d => validateRunRecord({ ...d.data(), id: d.id }))
    .filter((r): r is RunRecord => r !== null)
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

/**
 * Fetch the leaderboard for a given day.
 * Returns empty entries array if no data yet.
 */
export async function loadLeaderboard(date: string): Promise<LeaderboardDocument> {
  const dateKey = date.replace(/-/g, '')
  const snap = await leaderboardRef().doc(dateKey).get()
  if (!snap.exists) return { date, entries: [] }
  const data = snap.data() as Partial<LeaderboardDocument>
  return {
    date,
    entries: Array.isArray(data.entries) ? data.entries : [],
  }
}

async function updateLeaderboard(
  record: RunRecord,
  db: FirebaseFirestore.Firestore,
): Promise<void> {
  const dateKey = record.date.replace(/-/g, '')
  const docRef = leaderboardRef().doc(dateKey)

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef)
    const existing: LeaderboardDocument = snap.exists
      ? (snap.data() as LeaderboardDocument)
      : { date: record.date, entries: [] }

    const newEntry: LeaderboardEntry = {
      uid: record.uid,
      displayName: 'Trainer',  // B-7.4 will wire up real names via useAuth
      badgesEarned: record.badgesEarned,
      finalRound: record.finalRound,
      outcome: record.outcome,
      timestamp: record.timestamp,
    }

    // Replace existing entry for this uid (if any), then re-sort
    const withoutThisPlayer = existing.entries.filter(e => e.uid !== record.uid)
    const updated = [...withoutThisPlayer, newEntry]
      .sort((a, b) => b.badgesEarned - a.badgesEarned || a.timestamp - b.timestamp)
      .slice(0, MAX_LEADERBOARD_ENTRIES)

    tx.set(docRef, { date: record.date, entries: updated })
  })
}
