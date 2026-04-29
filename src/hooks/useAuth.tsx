'use client'

import {
  EmailAuthProvider,
  GoogleAuthProvider,
  type User,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth'
import { type ReactNode, createContext, useContext, useEffect, useRef, useState } from 'react'

import { getFirebaseAuth, isFirebaseAuthConfigured } from '@/lib/firebase/client'

/**
 * Thrown by signInWithGoogle / signInWithEmail / signUpWithEmail when the
 * caller was anonymous and the credential they provided already belongs to
 * another Firebase user. The auth flow falls back to signing into the
 * existing account, which means the *anonymous* user's uid (and any data
 * keyed by it — daily history, infinite stats, etc.) is now orphaned.
 *
 * Surfaces in the UI should catch this and warn the player that
 * pre-sign-in progress was tied to a different account on this device.
 */
export class AnonymousProgressOrphanedError extends Error {
  constructor(message = 'Signed into an existing account; anonymous progress on this device was not migrated.') {
    super(message)
    this.name = 'AnonymousProgressOrphanedError'
  }
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  configured: boolean
  signInWithGoogle: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

function getErrorCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code: unknown }).code
    return typeof code === 'string' ? code : undefined
  }
  return undefined
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isFirebaseAuthConfigured()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(configured)
  // Set by the user-initiated sign-in methods. While true, the auth-state
  // listener must not mint a fresh anonymous user when it sees a transient
  // null event mid-flow (e.g. signInWithCredential briefly clears the
  // current user before swapping in the new one). Without this guard the
  // anonymous re-mint races with the named sign-in and the user ends up
  // anonymous again — making the UI look "not signed in".
  const signInInProgressRef = useRef(false)

  useEffect(() => {
    if (!configured) return
    const auth = getFirebaseAuth()
    let signingInAnonymously = false
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u)
        setLoading(false)
        return
      }
      if (signInInProgressRef.current) return
      // Anonymous-first (CLAUDE.md #1): mint an anonymous uid so games can
      // persist per-device state. The listener re-fires with the new user.
      if (signingInAnonymously) return
      signingInAnonymously = true
      try {
        await signInAnonymously(auth)
      } catch (err) {
        console.error('Anonymous sign-in failed:', err)
        setUser(null)
        setLoading(false)
      } finally {
        signingInAnonymously = false
      }
    })
    return () => unsub()
  }, [configured])

  const signInWithGoogle = async () => {
    signInInProgressRef.current = true
    try {
      const auth = getFirebaseAuth()
      const provider = new GoogleAuthProvider()
      const current = auth.currentUser

      // If the caller is currently anonymous, link the Google credential to the
      // existing anonymous user so their uid (and all uid-keyed Firestore data)
      // carries over. Falls back to a normal sign-in if the credential is
      // already tied to another account.
      if (current?.isAnonymous) {
        try {
          await linkWithPopup(current, provider)
          return
        } catch (err) {
          const code = getErrorCode(err)
          if (code === 'auth/credential-already-in-use') {
            const credential = GoogleAuthProvider.credentialFromError(
              err as Parameters<typeof GoogleAuthProvider.credentialFromError>[0]
            )
            if (credential) {
              await signInWithCredential(auth, credential)
              throw new AnonymousProgressOrphanedError()
            }
          }
          throw err
        }
      }

      await signInWithPopup(auth, provider)
    } finally {
      signInInProgressRef.current = false
    }
  }

  const signInWithEmail = async (email: string, password: string) => {
    signInInProgressRef.current = true
    try {
      const auth = getFirebaseAuth()
      const current = auth.currentUser

      if (current?.isAnonymous) {
        const credential = EmailAuthProvider.credential(email, password)
        try {
          await linkWithCredential(current, credential)
          return
        } catch (err) {
          const code = getErrorCode(err)
          if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') {
            // Email already belongs to a Firebase user — sign into that one.
            await signInWithCredential(auth, credential)
            throw new AnonymousProgressOrphanedError()
          }
          throw err
        }
      }

      await signInWithEmailAndPassword(auth, email, password)
    } finally {
      signInInProgressRef.current = false
    }
  }

  const signUpWithEmail = async (email: string, password: string) => {
    signInInProgressRef.current = true
    try {
      const auth = getFirebaseAuth()
      const current = auth.currentUser

      if (current?.isAnonymous) {
        const credential = EmailAuthProvider.credential(email, password)
        try {
          await linkWithCredential(current, credential)
          return
        } catch (err) {
          const code = getErrorCode(err)
          if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') {
            // Email already taken by another Firebase user — fall back to
            // signing into that account. Anonymous progress is orphaned.
            await signInWithCredential(auth, credential)
            throw new AnonymousProgressOrphanedError()
          }
          throw err
        }
      }

      await createUserWithEmailAndPassword(auth, email, password)
    } finally {
      signInInProgressRef.current = false
    }
  }

  const signOut = async () => {
    const auth = getFirebaseAuth()
    await firebaseSignOut(auth)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        configured,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
