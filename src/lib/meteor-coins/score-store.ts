/**
 * Meteor Coins — Firestore paths for per-stage player scores.
 *
 * Layout:
 *   meteor-coins-scores/{stage}_{uid}   one record per player per stage: their best
 *   meteor-coins-boards/{stage}         the stage's board (top entries + player count)
 *
 * Both are server-only (firestore.rules): the browser goes through
 * /api/v1/meteor-coins/scores. Names on a board are snapshots taken when the
 * player's record is written; a POST with no results refreshes them, which
 * the browser sends when GET reports the name is stale.
 */
import { FieldValue } from 'firebase-admin/firestore'

import type { Stars } from '@/app/meteor-coins/lib/progress'
import {
  type Board,
  type BoardEntry,
  type MyScores,
  type Placement,
  type ScoreResult,
  boardView,
  emptyBoard,
  mergeEntry,
  placementOn,
} from '@/app/meteor-coins/lib/scoreboard'
import { STAGES } from '@/app/meteor-coins/lib/stages'
import { getFirestoreDb } from '@/lib/firebase/server'
import type { AuthClaims } from '@/lib/users/profile'

const SCORES = 'meteor-coins-scores'
const BOARDS = 'meteor-coins-boards'

const PLAYABLE = STAGES.filter(s => s.playable).map(s => s.slug)

type ScoreDoc = {
  uid: string
  stage: string
  value: number
  stars: Stars
  plays: number
  /** When the best was made, ms since epoch. */
  at: number
}

type Player = { uid: string; name: string; named: boolean }

function scoreId(stage: string, uid: string): string {
  return `${stage}_${uid}`
}

async function loadPlayer(claims: AuthClaims): Promise<Player> {
  const snap = await getFirestoreDb().doc(`users/${claims.uid}`).get()
  const nickname = ((snap.data() as { nickname?: string } | undefined)?.nickname ?? '').trim()
  // The token says whether the player is anonymous; the profile can lag it.
  const named = !claims.isAnonymous && nickname.length > 0
  return { uid: claims.uid, name: nickname, named }
}

function readBoard(stage: string, data: FirebaseFirestore.DocumentData | undefined): Board {
  const board = emptyBoard(stage)
  if (!data) return board
  if (typeof data.players === 'number') board.players = data.players
  if (Array.isArray(data.entries)) board.entries = data.entries as BoardEntry[]
  return board
}

/**
 * Keeps the better of the stored and incoming result for one stage, and
 * puts the player's current name on the board. With no incoming result it
 * only refreshes an existing record (or does nothing).
 */
async function recordOne(
  player: Player,
  stage: string,
  incoming: ScoreResult | undefined,
  now: number
): Promise<Placement | null> {
  const db = getFirestoreDb()
  const scoreRef = db.collection(SCORES).doc(scoreId(stage, player.uid))
  const boardRef = db.collection(BOARDS).doc(stage)

  return db.runTransaction(async tx => {
    const [scoreSnap, boardSnap] = await Promise.all([tx.get(scoreRef), tx.get(boardRef)])
    const existing = scoreSnap.exists ? (scoreSnap.data() as ScoreDoc) : null
    if (!existing && !incoming) return null

    const improved = incoming !== undefined && incoming.value > (existing?.value ?? -1)
    const value = improved ? incoming.value : (existing?.value ?? 0)
    const stars = Math.max(existing?.stars ?? 0, incoming?.stars ?? 0) as Stars
    const at = improved || !existing ? now : existing.at
    const doc: ScoreDoc = {
      uid: player.uid,
      stage,
      value,
      stars,
      plays: (existing?.plays ?? 0) + (incoming ? 1 : 0),
      at,
    }
    tx.set(scoreRef, { ...doc, updatedAt: FieldValue.serverTimestamp() })

    let board = readBoard(stage, boardSnap.data())
    if (!existing) board = { ...board, players: board.players + 1 }
    board = mergeEntry(board, {
      uid: player.uid,
      name: player.name,
      named: player.named,
      value,
      stars,
      at,
    })
    tx.set(boardRef, { stage, players: board.players, entries: board.entries })

    return placementOn(board, player.uid, value, stars)
  })
}

/**
 * Saves the caller's results (any stages) and refreshes their name on every
 * stage they have a record for. Returns their standing everywhere.
 */
export async function recordResults(claims: AuthClaims, results: ScoreResult[]): Promise<MyScores> {
  const player = await loadPlayer(claims)
  const incoming = new Map(results.map(r => [r.stage, r]))
  const now = Date.now()
  const stages: MyScores['stages'] = {}
  for (const stage of PLAYABLE) {
    const placement = await recordOne(player, stage, incoming.get(stage), now)
    if (placement) stages[stage] = placement
  }
  return { signedUp: !claims.isAnonymous, nickname: player.name, nameStale: false, stages }
}

/** The caller's standing on every stage they've played. Reads only. */
export async function loadMyScores(claims: AuthClaims): Promise<MyScores> {
  const db = getFirestoreDb()
  const player = await loadPlayer(claims)
  const refs = PLAYABLE.flatMap(stage => [
    db.collection(SCORES).doc(scoreId(stage, player.uid)),
    db.collection(BOARDS).doc(stage),
  ])
  const snaps = await db.getAll(...refs)
  const stages: MyScores['stages'] = {}
  let nameStale = false
  PLAYABLE.forEach((stage, i) => {
    const scoreSnap = snaps[i * 2]
    if (!scoreSnap.exists) return
    const score = scoreSnap.data() as ScoreDoc
    const board = readBoard(stage, snaps[i * 2 + 1].data())
    stages[stage] = placementOn(board, player.uid, score.value, score.stars)
    const entry = board.entries.find(e => e.uid === player.uid)
    if (entry && (entry.named !== player.named || entry.name !== player.name)) nameStale = true
  })
  return { signedUp: !claims.isAnonymous, nickname: player.name, nameStale, stages }
}

/** A stage's board for anyone, with the caller's own standing when known. */
export async function loadBoard(stage: string, claims: AuthClaims | null) {
  const db = getFirestoreDb()
  const boardSnap = await db.collection(BOARDS).doc(stage).get()
  const board = readBoard(stage, boardSnap.data())
  let me: Placement | null = null
  if (claims) {
    const scoreSnap = await db.collection(SCORES).doc(scoreId(stage, claims.uid)).get()
    if (scoreSnap.exists) {
      const score = scoreSnap.data() as ScoreDoc
      me = placementOn(board, claims.uid, score.value, score.stars)
    }
  }
  return boardView(board, me)
}
