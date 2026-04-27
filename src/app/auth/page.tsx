'use client'

import { FirebaseError } from 'firebase/app'
import { useRouter, useSearchParams } from 'next/navigation'
import { type FormEvent, useEffect, useState } from 'react'

import { AuthProvider, useAuth } from '@/app/trivia/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

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
        <Card className="w-full bg-space-dark/80 border-space-grey">
          <CardContent className="pt-6 text-center text-cream-white/80">
            Sign-in isn&apos;t configured yet. Please try again later.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 max-w-md mx-auto py-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-space-gold mb-2">
          {mode === 'signin' ? 'Sign in' : 'Create an account'}
        </h1>
        <p className="text-cream-white/70 text-sm">
          Save your trivia stats and compete on the leaderboard
        </p>
      </div>

      <Card className="w-full bg-space-dark/80 border-space-grey">
        <CardHeader>
          <CardTitle className="text-cream-white text-center">Welcome</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button
            variant="space"
            size="lg"
            className="w-full"
            onClick={handleGoogle}
            disabled={submitting}
          >
            Sign in with Google
          </Button>

          <div className="flex items-center gap-3 text-cream-white/40 text-xs">
            <div className="flex-1 h-px bg-space-grey" />
            OR
            <div className="flex-1 h-px bg-space-grey" />
          </div>

          <form className="flex flex-col gap-3" onSubmit={handleEmail}>
            <Input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-space-black/50 border-space-grey text-cream-white placeholder:text-cream-white/30"
              autoComplete="email"
            />
            <Input
              type="password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-space-black/50 border-space-grey text-cream-white placeholder:text-cream-white/30"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              minLength={6}
            />
            <Button
              type="submit"
              variant="outline"
              className="w-full"
              disabled={submitting || email.length === 0 || password.length === 0}
            >
              {mode === 'signin' ? 'Sign in with email' : 'Create account'}
            </Button>
          </form>

          {error && (
            <div className="text-red-400 text-sm text-center" role="alert">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setError(null)
              setMode(mode === 'signin' ? 'signup' : 'signin')
            }}
            className="text-cream-white/50 text-sm text-center hover:text-cream-white/80 transition-colors"
          >
            {mode === 'signin'
              ? "Don't have an account? Sign up"
              : 'Already have an account? Sign in'}
          </button>
        </CardContent>
      </Card>
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
      <AuthPageInner />
    </AuthProvider>
  )
}
