'use client'

import {
  GoogleAuthProvider,
  type User,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth'
import { type ReactNode, createContext, useContext, useEffect, useState } from 'react'

import { getFirebaseAuth, isFirebaseAuthConfigured } from '@/lib/firebase/client'

interface AuthContextValue {
  user: User | null
  loading: boolean
  configured: boolean
  signInWithGoogle: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isFirebaseAuthConfigured()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(configured)

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
    const auth = getFirebaseAuth()
    const provider = new GoogleAuthProvider()
    await signInWithPopup(auth, provider)
  }

  const signInWithEmail = async (email: string, password: string) => {
    const auth = getFirebaseAuth()
    await signInWithEmailAndPassword(auth, email, password)
  }

  const signUpWithEmail = async (email: string, password: string) => {
    const auth = getFirebaseAuth()
    await createUserWithEmailAndPassword(auth, email, password)
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
