import { FieldValue, Timestamp } from 'firebase-admin/firestore'

import { getFirestoreDb } from '@/lib/firebase/server'

export const NICKNAME_MAX_LENGTH = 20

export interface UserProfile {
  uid: string
  email: string | null
  authDisplayName: string | null
  photoURL: string | null
  nickname: string
  nicknameLower: string
  isAnonymous: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface AuthClaims {
  uid: string
  email?: string
  name?: string
  picture?: string
  isAnonymous: boolean
}

export function sanitizeNickname(raw: string): string {
  return raw.trim().slice(0, NICKNAME_MAX_LENGTH)
}

function userDocRef(uid: string) {
  return getFirestoreDb().doc(`users/${uid}`)
}

function nicknameDocRef(nicknameLower: string) {
  return getFirestoreDb().doc(`nicknames/${nicknameLower}`)
}

export async function getOrCreateProfile(claims: AuthClaims): Promise<UserProfile> {
  const ref = userDocRef(claims.uid)
  const snap = await ref.get()
  if (snap.exists) {
    // Refresh isAnonymous on every auth touchpoint so leaderboard filters
    // see current state — including the case where an anonymous user
    // upgrades by linking a credential and now has sign_in_provider != 'anonymous'.
    const data = snap.data() as UserProfile
    if (data.isAnonymous !== claims.isAnonymous) {
      await ref.set(
        { isAnonymous: claims.isAnonymous, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      )
      return { ...data, isAnonymous: claims.isAnonymous }
    }
    return data
  }

  const now = FieldValue.serverTimestamp()
  const seed = {
    uid: claims.uid,
    email: claims.email ?? null,
    authDisplayName: claims.name ?? null,
    photoURL: claims.picture ?? null,
    nickname: '',
    nicknameLower: '',
    isAnonymous: claims.isAnonymous,
    createdAt: now,
    updatedAt: now,
  }
  await ref.set(seed, { merge: true })
  const fresh = await ref.get()
  return fresh.data() as UserProfile
}

// Upsert just the isAnonymous flag without doing a full read. Cheaper than
// getOrCreateProfile for write paths that already know they don't need the
// rest of the profile (e.g. starting an infinite run).
export async function ensureAnonymousFlag(claims: AuthClaims): Promise<void> {
  await userDocRef(claims.uid).set(
    { isAnonymous: claims.isAnonymous, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  )
}

export class NicknameInUseError extends Error {
  constructor() {
    super('Nickname is already taken')
    this.name = 'NicknameInUseError'
  }
}

export async function setNickname(uid: string, raw: string): Promise<{ nickname: string }> {
  const clean = sanitizeNickname(raw)
  if (!clean) throw new Error('Nickname cannot be empty')
  const cleanLower = clean.toLowerCase()

  const db = getFirestoreDb()
  const userRef = userDocRef(uid)
  const newClaimRef = nicknameDocRef(cleanLower)

  await db.runTransaction(async (tx) => {
    const [userSnap, claimSnap] = await Promise.all([tx.get(userRef), tx.get(newClaimRef)])

    if (claimSnap.exists) {
      const claim = claimSnap.data() as { uid: string }
      if (claim.uid !== uid) throw new NicknameInUseError()
    }

    const oldNicknameLower = (userSnap.data() as UserProfile | undefined)?.nicknameLower ?? ''
    if (oldNicknameLower && oldNicknameLower !== cleanLower) {
      tx.delete(nicknameDocRef(oldNicknameLower))
    }

    tx.set(newClaimRef, { uid, takenAt: FieldValue.serverTimestamp() })

    tx.set(
      userRef,
      {
        nickname: clean,
        nicknameLower: cleanLower,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
  })

  return { nickname: clean }
}

export async function getProfile(uid: string): Promise<UserProfile | null> {
  const snap = await userDocRef(uid).get()
  return snap.exists ? (snap.data() as UserProfile) : null
}
