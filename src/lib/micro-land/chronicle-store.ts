/**
 * The chronicle in Firestore: one document per player.
 *
 * Stored as a single JSON string rather than as nested maps, which is the one
 * decision in this file worth explaining. A chronicle is a save blob — it is
 * read whole, written whole, and never queried. As nested maps, Firestore would
 * index every leaf of every archived creature on every write: a few hundred
 * species times forty-odd fields of pixel art, none of which anything will ever
 * filter or sort on. It would also put the ids straight into field paths, and
 * those ids contain colons (`summon:cinder-wyrm:3`, `summoned:the-drowned-
 * cathedral`), which field paths do not take kindly to.
 *
 * As one unindexed string it is a single cheap write, and the shape of the game
 * data stops being Firestore's business — see the `fieldOverrides` entry for
 * `microLand.blob` in `firestore.indexes.json`, which is what keeps it unindexed
 * and therefore clear of the 7.5 KiB index-entry ceiling.
 *
 * The trade is that the document is opaque in the console and cannot be queried
 * across players. That is the right trade while these records are private; a
 * public gallery would want creatures as their own documents, and should add
 * that alongside rather than unpicking this.
 */
import { FieldValue } from 'firebase-admin/firestore'

import { CHRONICLE_VERSION, type ChronicleData } from '@/app/micro-land/chronicle/types'
import { chronicleBytes, decodeChronicle } from '@/app/micro-land/chronicle/wire'
import { getFirestoreDb } from '@/lib/firebase/server'

function chronicleRef(uid: string) {
  return getFirestoreDb().doc(`users/${uid}/microLand/chronicle`)
}

/** Null when this player has never saved, or when what they saved is unreadable. */
export async function loadChronicle(uid: string): Promise<ChronicleData | null> {
  const snap = await chronicleRef(uid).get()
  if (!snap.exists) return null
  return decodeChronicle(snap.data()?.blob)
}

/**
 * Overwrite this player's chronicle.
 *
 * A full replace rather than a merge: the client holds the authoritative copy in
 * memory, having already merged the stored one into it on sign-in, and it sends
 * its whole state on every flush. Merging here as well would resurrect species
 * the player's own client had pruned.
 *
 * The scalars alongside the blob are there to be readable without parsing it —
 * enough to answer "when did this player last play, and how big is their
 * archive" from the console or a script.
 */
export async function saveChronicle(uid: string, data: ChronicleData): Promise<void> {
  await chronicleRef(uid).set({
    blob: JSON.stringify(data),
    version: CHRONICLE_VERSION,
    bytes: chronicleBytes(data),
    speciesCount: Object.keys(data.species).length,
    updatedAt: FieldValue.serverTimestamp(),
  })
}
