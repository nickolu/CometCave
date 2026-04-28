import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { type Auth, getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

let _db: FirebaseFirestore.Firestore | null = null
let _auth: Auth | null = null

function ensureApp(): void {
  if (getApps().length) return

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

export function getFirestoreDb(): FirebaseFirestore.Firestore {
  ensureApp()
  if (!_db) {
    _db = getFirestore()
  }
  return _db
}

export function getFirebaseAuthAdmin(): Auth {
  ensureApp()
  if (!_auth) {
    _auth = getAuth()
  }
  return _auth
}
