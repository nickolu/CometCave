import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

let _db: FirebaseFirestore.Firestore | null = null

export function getFirestoreDb(): FirebaseFirestore.Firestore {
  if (!getApps().length) {
    const projectId = process.env.FIREBASE_PROJECT_ID
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        'Firebase config missing. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables.'
      )
    }

    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    })
  }

  if (!_db) {
    _db = getFirestore()
  }

  return _db
}
