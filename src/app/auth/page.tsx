'use client'

import { FirebaseError } from 'firebase/app'
import { useRouter, useSearchParams } from 'next/navigation'
import { type FormEvent, Suspense, useEffect, useState } from 'react'

import { ChunkyButton } from '@/components/ui/chunky-button'
import { ChunkyCard, ChunkyCardContent, ChunkyCardHeader, ChunkyCardTitle } from '@/components/ui/chunky-card'
import { Input } from '@/components/ui/input'
import { AuthProvider, useAuth } from '@/hooks/useAuth'

function AuthPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') ?? '/trivia'
  const { user, loading, configured, signInWithGoogle, signInWithEmail, signUpWithEmail } =
    useAuth()

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && user) {
      router.replace(redirectTo)
    }
  }, [loading, user, redirectTo, router])

  const handleGoogle = async () => {
    setError(null)
    setSubmitting(true)
    try {
      await signInWithGoogle()
      router.replace(redirectTo)
    } catch (err) {
      setError(formatAuthError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleEmail = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password)
      } else {
        await signUpWithEmail(email, password)
      }
      router.replace(redirectTo)
    } catch (err) {
      setError(formatAuthError(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (!configured) {
    return (
      <div className="flex flex-col items-center gap-6 max-w-md mx-auto py-8">
        <ChunkyCard variant="surface-container" className="w-full">
          <ChunkyCardContent className="pt-6 text-center text-on-surface/80">
            Sign-in isn&apos;t configured yet. Please try again later.
          </ChunkyCardContent>
        </ChunkyCard>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 max-w-md mx-auto py-8">
      {/* Header badge */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center justify-center w-20 h-20 rounded-full bg-primary-container/20 shadow-glow-primary">
          <span className="material-symbols-outlined text-[40px] text-ds-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
            fingerprint
          </span>
        </div>
        <div className="text-center">
          <h1 className="font-headline text-headline-md text-on-surface">
            {mode === 'signin' ? 'Trainer ID' : 'New Recruit'}
          </h1>
          <p className="text-on-surface-variant text-sm mt-1">
            Save your trivia stats and compete on the leaderboard
          </p>
        </div>
      </div>

      {/* Terminal canvas */}
      <ChunkyCard variant="surface-container" shadow="hero" className="w-full border-[6px] border-surface-container-high bg-ds-surface/80 backdrop-blur-2xl">
        <ChunkyCardHeader>
          <ChunkyCardTitle className="text-center text-on-surface">Welcome</ChunkyCardTitle>
        </ChunkyCardHeader>
        <ChunkyCardContent className="flex flex-col gap-4">
          <ChunkyButton
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleGoogle}
            disabled={submitting}
            iconStart={<span className="material-symbols-outlined text-[20px]">login</span>}
          >
            Sign in with Google
          </ChunkyButton>

          <div className="flex items-center gap-3 text-on-surface/40 text-xs">
            <div className="flex-1 h-px bg-outline-variant" />
            OR
            <div className="flex-1 h-px bg-outline-variant" />
          </div>

          <form className="flex flex-col gap-3" onSubmit={handleEmail}>
            <Input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-surface-dim/50 border-outline-variant text-on-surface placeholder:text-on-surface/30"
              autoComplete="email"
            />
            <Input
              type="password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-surface-dim/50 border-outline-variant text-on-surface placeholder:text-on-surface/30"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              minLength={6}
            />
            <ChunkyButton
              type="submit"
              variant="secondary"
              className="w-full"
              disabled={submitting || email.length === 0 || password.length === 0}
            >
              {mode === 'signin' ? 'Sign in with email' : 'Create account'}
            </ChunkyButton>
          </form>

          {error && (
            <div className="text-ds-error text-sm text-center" role="alert">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setError(null)
              setMode(mode === 'signin' ? 'signup' : 'signin')
            }}
            className="text-on-surface/50 text-sm text-center hover:text-on-surface/80 transition-colors"
          >
            {mode === 'signin'
              ? "Don't have an account? Sign up"
              : 'Already have an account? Sign in'}
          </button>
        </ChunkyCardContent>
      </ChunkyCard>
    </div>
  )
}

function formatAuthError(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Invalid email or password.'
      case 'auth/email-already-in-use':
        return 'That email is already registered. Try signing in.'
      case 'auth/weak-password':
        return 'Password must be at least 6 characters.'
      case 'auth/invalid-email':
        return 'That email address is not valid.'
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return 'Sign-in cancelled.'
      default:
        return err.message
    }
  }
  return 'Something went wrong. Please try again.'
}

export default function AuthPage() {
  return (
    <AuthProvider>
      <Suspense fallback={null}>
        <AuthPageInner />
      </Suspense>
    </AuthProvider>
  )
}
