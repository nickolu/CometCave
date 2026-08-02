/**
 * Shelved worlds in Firestore: one document per saved world.
 *
 * A world is a save blob for the same reasons the chronicle is — read whole,
 * written whole, never queried by its contents — and stored the same way, as one
 * unindexed JSON string. See the note in `chronicle-store.ts`; everything it
 * says about indexing every leaf of every creature applies here with more force,
 * because a world carries three hundred of them.
 *
 * Where this one differs is the *listing*. The shelf has to draw eight rows
 * without pulling eight save blobs across the network, so the handful of things
 * a row shows are kept as their own fields alongside the blob and read with a
 * projection. They are denormalized copies of what is inside the blob, written
 * in the same operation, and the blob remains the truth: if the two ever
 * disagree, the row is cosmetic and the world is not.
 */
import { FieldValue } from 'firebase-admin/firestore'

import {
  WORLD_SAVE_VERSION,
  type WorldSave,
  type WorldSummary,
} from '@/app/micro-land/worlds/types'
import { MAX_SAVED_WORLDS, decodeWorldSave, worldSaveBytes } from '@/app/micro-land/worlds/wire'
import { getFirestoreDb } from '@/lib/firebase/server'

function worldsRef(uid: string) {
  return getFirestoreDb().collection(`users/${uid}/microLandWorlds`)
}

/**
 * Every world on this player's shelf, without reading a single save.
 *
 * `select()` is what makes this cheap: Firestore bills and transfers only the
 * named fields, so the blob — the entire point of the document — never leaves
 * the database.
 */
export async function listWorlds(uid: string): Promise<WorldSummary[]> {
  const snap = await worldsRef(uid)
    .select('name', 'themeId', 'landName', 'creatures', 'elapsed', 'createdAt', 'updatedAt')
    .get()

  return snap.docs.map(doc => {
    const data = doc.data()
    return {
      id: doc.id,
      name: typeof data.name === 'string' ? data.name : 'A world',
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0,
      updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0,
      themeId: typeof data.themeId === 'string' ? data.themeId : 'earth',
      landName: typeof data.landName === 'string' ? data.landName : null,
      creatures: typeof data.creatures === 'number' ? data.creatures : 0,
      elapsed: typeof data.elapsed === 'number' ? data.elapsed : 0,
    }
  })
}

/** Null when there's no such world, or what's stored is unreadable. */
export async function loadWorld(uid: string, id: string): Promise<WorldSave | null> {
  const snap = await worldsRef(uid).doc(id).get()
  if (!snap.exists) return null
  return decodeWorldSave(snap.data()?.blob)
}

/**
 * Write one world, creating it if it's new.
 *
 * The cap is enforced here as well as in the client, and the check is
 * deliberately "how many *other* worlds are there" rather than a plain count —
 * writing back a world already on the shelf must keep working when the shelf is
 * full, which is the ordinary case for every autosave once a player has filled
 * it. Returns false when the shelf has no room for a genuinely new world.
 */
export async function saveWorld(uid: string, save: WorldSave): Promise<boolean> {
  const collection = worldsRef(uid)
  const existing = await collection.select().get()
  const isNew = !existing.docs.some(doc => doc.id === save.id)
  if (isNew && existing.size >= MAX_SAVED_WORLDS) return false

  await collection.doc(save.id).set({
    blob: JSON.stringify(save),
    version: WORLD_SAVE_VERSION,
    bytes: worldSaveBytes(save),
    // The projection the shelf lists on. Kept in step with the blob by being
    // written in the same call and never on their own.
    name: save.name,
    themeId: save.themeId,
    landName: save.terrain?.name ?? null,
    creatures: save.world.creatures.length,
    elapsed: save.world.elapsed,
    createdAt: save.createdAt,
    updatedAt: save.updatedAt,
    storedAt: FieldValue.serverTimestamp(),
  })

  return true
}

export async function deleteWorld(uid: string, id: string): Promise<void> {
  await worldsRef(uid).doc(id).delete()
}
