/**
 * The campaign in Firestore: one live document per player, plus an archive.
 *
 *   users/{uid}/dicebound/campaign        the whole live game, one JSON blob
 *   users/{uid}/diceboundChapters/{n}     transcript condensed out of it
 *
 * The blob is a single JSON string rather than nested maps, for the same reason
 * Micro Land's chronicle is — a campaign is a save, read whole and written
 * whole, and never queried. As nested maps, Firestore would index every leaf of
 * every transcript entry on every write: hundreds of paragraphs of narration,
 * dozens of modifier arrays, and now a graph of a couple of hundred entities,
 * none of which anything will ever filter or sort on. It would also index the
 * narration text itself, which carries the 1,500-byte-per-index-entry limit
 * straight into a field whose whole job is to hold long prose.
 *
 * See the `dicebound.blob` and `diceboundChapters.blob` entries in
 * `firestore.indexes.json`, which are what keep both unindexed.
 *
 * The trade is that the documents are opaque in the console, which is what the
 * scalars alongside each blob are for. Anything a future home page, leaderboard
 * or share card needs to read must become a scalar here — digging it back out of
 * the blob means parsing every player's whole story to answer one question.
 */
import { FieldValue } from 'firebase-admin/firestore'

import {
  CAMPAIGN_VERSION,
  type Campaign,
  type Chapter,
  campaignBytes,
  validateCampaign,
  validateChapter,
} from '@/app/dicebound/domain/campaign'
import { totalRanks } from '@/app/dicebound/domain/character'
import { levelFor } from '@/app/dicebound/domain/kit'
import { dayOf } from '@/app/dicebound/domain/world'
import { getFirestoreDb } from '@/lib/firebase/server'

function campaignRef(uid: string) {
  return getFirestoreDb().doc(`users/${uid}/dicebound/campaign`)
}

function chaptersRef(uid: string) {
  return getFirestoreDb().collection(`users/${uid}/diceboundChapters`)
}

/** Null when this player has never played, or when what they saved is unreadable. */
export async function loadCampaign(uid: string): Promise<Campaign | null> {
  const snap = await campaignRef(uid).get()
  if (!snap.exists) return null

  const blob = snap.data()?.blob
  if (typeof blob !== 'string') return null

  try {
    // Version 1 campaigns are migrated in here rather than refused — see
    // SUPPORTED_VERSIONS. A player who last visited before the world graph
    // existed opens their story and finds it exactly where they left it.
    return validateCampaign(JSON.parse(blob))
  } catch {
    return null
  }
}

/**
 * Overwrite this player's campaign.
 *
 * A full replace rather than a merge: merging would resurrect transcript
 * entries that condense had deliberately archived away.
 */
export async function saveCampaign(uid: string, campaign: Campaign): Promise<void> {
  await campaignRef(uid).set({
    blob: JSON.stringify(campaign),
    version: CAMPAIGN_VERSION,
    bytes: campaignBytes(campaign),
    title: campaign.title,
    characterName: campaign.character.name,
    turns: campaign.stats.turns,
    currentStreak: campaign.currentStreak,
    // Readable phase 2 state. Cheap to write, and the alternative is parsing
    // every blob in the collection to ask how far anyone has got.
    level: levelFor(totalRanks(campaign.character)),
    className: campaign.kit.className ?? null,
    species: campaign.kit.species?.name ?? null,
    storyDay: dayOf(campaign.world.clock),
    entities: Object.keys(campaign.world.entities).length,
    chapters: campaign.chapters,
    updatedAt: FieldValue.serverTimestamp(),
  })
}

/**
 * Abandon a story, archive included.
 *
 * Firestore does not cascade, and a subcollection left behind by a deleted
 * parent is invisible in the console but still billed and still returned by
 * collection-group queries — so the chapters go explicitly, and they go first.
 * Losing the live campaign while the archive survives is recoverable; the
 * reverse leaves a player whose story is half-deleted.
 */
export async function deleteCampaign(uid: string): Promise<void> {
  await deleteChapters(uid)
  await campaignRef(uid).delete()
}

/**
 * Keep a slice of transcript that condense is about to drop.
 *
 * Write-once and never read during a turn, so this is off the hot path
 * entirely: it costs one document write roughly every twenty turns, and it is
 * the difference between a game that forgets its own first act and one that
 * merely stops quoting it.
 *
 * Idempotent on `index`, so a retried condense overwrites rather than
 * duplicating.
 */
export async function archiveChapter(uid: string, chapter: Chapter): Promise<void> {
  if (chapter.entries.length === 0) return

  await chaptersRef(uid)
    .doc(String(chapter.index))
    .set({
      blob: JSON.stringify(chapter),
      index: chapter.index,
      entries: chapter.entries.length,
      archivedAt: chapter.archivedAt,
      bytes: Buffer.byteLength(JSON.stringify(chapter), 'utf8'),
      createdAt: FieldValue.serverTimestamp(),
    })
}

/** Every archived chapter, oldest first. Unreadable ones are skipped, not thrown. */
export async function loadChapters(uid: string): Promise<Chapter[]> {
  const snap = await chaptersRef(uid).orderBy('index').get()

  const chapters: Chapter[] = []
  for (const doc of snap.docs) {
    const blob = doc.data()?.blob
    if (typeof blob !== 'string') continue
    try {
      const chapter = validateChapter(JSON.parse(blob))
      if (chapter) chapters.push(chapter)
    } catch {
      // One corrupt chapter must not cost the player the rest of the archive.
    }
  }
  return chapters
}

export async function deleteChapters(uid: string): Promise<void> {
  const db = getFirestoreDb()
  // listDocuments rather than a query: it returns references without reading
  // the blobs, so deleting an archive does not pay to load it first.
  const refs = await chaptersRef(uid).listDocuments()

  for (let i = 0; i < refs.length; i += 400) {
    const batch = db.batch()
    for (const ref of refs.slice(i, i + 400)) batch.delete(ref)
    await batch.commit()
  }
}
