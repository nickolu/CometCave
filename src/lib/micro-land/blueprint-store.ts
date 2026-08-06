import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { getFirestoreDb } from '@/lib/firebase/server'
import type { CreatureBlueprint } from '@/app/micro-land/domain/types'

export interface SharedBlueprint {
  id: string
  name: string
  creatorNickname: string
  blueprintJson: string  // JSON.stringify(blueprint)
  createdAt: number      // ms epoch
}

function blueprintsRef() {
  return getFirestoreDb().collection('microLandBlueprints')
}

export async function saveSharedBlueprint(
  blueprint: CreatureBlueprint,
  creatorNickname: string
): Promise<string> {
  const doc = await blueprintsRef().add({
    name: blueprint.name,
    creatorNickname,
    blueprintJson: JSON.stringify(blueprint),
    createdAt: FieldValue.serverTimestamp(),
  })
  return doc.id
}

export async function getSharedBlueprint(id: string): Promise<SharedBlueprint | null> {
  const snap = await blueprintsRef().doc(id).get()
  if (!snap.exists) return null
  const d = snap.data()!
  return {
    id: snap.id,
    name: typeof d.name === 'string' ? d.name : 'Unknown',
    creatorNickname: typeof d.creatorNickname === 'string' ? d.creatorNickname : 'Explorer',
    blueprintJson: typeof d.blueprintJson === 'string' ? d.blueprintJson : '{}',
    createdAt: (d.createdAt as Timestamp)?.toMillis?.() ?? Date.now(),
  }
}

export async function listRecentBlueprints(limit = 20): Promise<SharedBlueprint[]> {
  const snap = await blueprintsRef()
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get()
  return snap.docs.map(doc => {
    const d = doc.data()
    return {
      id: doc.id,
      name: typeof d.name === 'string' ? d.name : 'Unknown',
      creatorNickname: typeof d.creatorNickname === 'string' ? d.creatorNickname : 'Explorer',
      blueprintJson: typeof d.blueprintJson === 'string' ? d.blueprintJson : '{}',
      createdAt: (d.createdAt as Timestamp)?.toMillis?.() ?? Date.now(),
    }
  })
}
