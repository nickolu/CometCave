'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { useTriviaUser } from '@/app/trivia/hooks/useTriviaUser'
import type { TriviaGameResult } from '@/app/trivia/models/trivia'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { formatDisplayDate, getTodayPST } from '@/lib/dates'
import { getDailyCategory } from '@/lib/trivia/categories'

import { NicknameDialog } from './NicknameDialog'
import { ResetNoticeButton } from './ResetNoticeButton'
import { SignInBanner } from './SignInCTA'

export function TriviaLanding({
  onStartGame,
  onViewStats,
  onViewLeaderboard,
  todayResult,
}: {
  onStartGame?: () => void
  onViewStats?: () => void
  onViewLeaderboard?: () => void
  todayResult: TriviaGameResult | null
}) {
  const { user, loading: authLoading, configured: authConfigured, signOut } = useAuth()
  const {
    loading: firestoreLoading,
    displayName,
    nickname,
    needsNickname,
    stats,
    setNickname,
  } = useTriviaUser()
  const [nicknameDialogOpen, setNicknameDialogOpen] = useState(false)

  const todayStr = getTodayPST()
  const alreadyPlayed = !!todayResult
  const showFirestoreLoadingHint = !!user && firestoreLoading
  const category = getDailyCategory(todayStr)
  const showSignInPromos = authConfigured && !authLoading && !user
  const nicknameSeed = nickname || user?.displayName || ''

  return (
    <div className="flex flex-col items-center gap-6 max-w-lg mx-auto py-8">
      <div className="w-full flex justify-end min-h-[1.75rem] text-sm">
        {!authConfigured ? null : authLoading ? null : user ? (
          <UserMenu
            displayName={displayName || user.email || 'Account'}
            photoURL={user.photoURL}
            onSignOut={signOut}
            onEditNickname={() => setNicknameDialogOpen(true)}
          />
        ) : (
          <Link
            href="/auth?redirect=/trivia"
            className="text-space-gold/80 hover:text-space-gold underline-offset-4 hover:underline transition-colors"
          >
            Sign in
          </Link>
        )}
      </div>

      <div className="text-center">
        <h1 className="text-4xl font-bold text-space-gold mb-2 inline-flex items-center gap-2">
          Daily Trivia
          <ResetNoticeButton />
        </h1>
        <p className="text-cream-white/70 text-lg">{formatDisplayDate(todayStr)}</p>
      </div>

      {/* Today's Theme banner */}
      <div className="w-full flex flex-col items-center gap-1 px-4 py-3 rounded-lg bg-gradient-to-r from-space-purple/30 to-space-gold/20 border border-space-gold/30">
        <div className="text-cream-white/60 text-xs uppercase tracking-widest">Today&apos;s Theme</div>
        <div className="flex items-center gap-2 text-xl font-bold text-space-gold">
          <span className="text-2xl">{category.icon}</span>
          <span>{category.name}</span>
        </div>
      </div>

      {/* Streak hero (logged-in users with an active streak) */}
      {user && stats.currentStreak > 0 && (
        <div className="w-full flex items-center justify-center gap-2 text-cream-white/80">
          <span className="text-2xl">🔥</span>
          <span className="text-lg">
            <span className="text-space-gold font-bold text-2xl">{stats.currentStreak}</span>
            <span className="ml-2">
              day{stats.currentStreak === 1 ? '' : 's'} in a row
            </span>
          </span>
        </div>
      )}

      {showSignInPromos && (
        <SignInBanner message="Sign in to save your progress" />
      )}

      {needsNickname && (
        <button
          type="button"
          onClick={() => setNicknameDialogOpen(true)}
          className="w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-space-purple/15 border border-space-purple/30 text-sm text-left hover:bg-space-purple/20 transition-colors"
        >
          <span className="text-cream-white/80">
            Pick a nickname for the leaderboard
          </span>
          <span className="text-space-gold whitespace-nowrap font-semibold">
            Set nickname →
          </span>
        </button>
      )}

      <Card className="w-full bg-space-dark/80 border-space-grey">
        <CardHeader>
          <CardTitle className="text-cream-white text-center">
            {showFirestoreLoadingHint
              ? 'Loading your progress…'
              : alreadyPlayed
                ? "You've already played today!"
                : 'Ready to test your knowledge?'}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <Button
            variant="space"
            size="lg"
            className="w-full text-lg py-6"
            disabled={alreadyPlayed || showFirestoreLoadingHint}
            onClick={onStartGame}
          >
            {alreadyPlayed ? 'Come Back Tomorrow' : "Start Today's Trivia"}
          </Button>

          {alreadyPlayed && todayResult && (
            <div className="text-center text-cream-white/60 text-sm">
              Today&apos;s score:{' '}
              <span className="text-space-gold font-semibold">
                {todayResult.score} pts
              </span>
              {' · '}
              {todayResult.correct}/{todayResult.total} correct
            </div>
          )}
        </CardContent>
      </Card>

      {/* Streak & Stats */}
      <div className="grid grid-cols-2 gap-4 w-full">
        <Card className="bg-space-dark/80 border-space-grey">
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-space-gold">{stats.currentStreak}</div>
            <div className="text-cream-white/60 text-sm">Current Streak</div>
          </CardContent>
        </Card>
        <Card className="bg-space-dark/80 border-space-grey">
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-space-purple-light">{stats.bestStreak}</div>
            <div className="text-cream-white/60 text-sm">Best Streak</div>
          </CardContent>
        </Card>
        <Card className="bg-space-dark/80 border-space-grey">
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-cream-white">{stats.gamesPlayed}</div>
            <div className="text-cream-white/60 text-sm">Games Played</div>
          </CardContent>
        </Card>
        <Card className="bg-space-dark/80 border-space-grey">
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-cream-white">
              {stats.totalQuestions > 0
                ? Math.round((stats.totalCorrect / stats.totalQuestions) * 100)
                : 0}
              %
            </div>
            <div className="text-cream-white/60 text-sm">Accuracy</div>
          </CardContent>
        </Card>
      </div>

      {/* Links */}
      <div className="flex gap-3 text-sm">
        <button
          onClick={onViewStats}
          className="text-space-gold hover:text-space-gold/80 transition-colors underline-offset-4 hover:underline"
        >
          My Stats
        </button>
        <span className="text-cream-white/20">·</span>
        <button
          onClick={onViewLeaderboard}
          className="text-space-gold hover:text-space-gold/80 transition-colors underline-offset-4 hover:underline"
        >
          Leaderboard
        </button>
      </div>

      {nicknameDialogOpen && (
        <NicknameDialog
          initialValue={nicknameSeed}
          onClose={() => setNicknameDialogOpen(false)}
          onSave={setNickname}
        />
      )}
    </div>
  )
}

function UserMenu({
  displayName,
  photoURL,
  onSignOut,
  onEditNickname,
}: {
  displayName: string
  photoURL: string | null
  onSignOut: () => Promise<void>
  onEditNickname: () => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-cream-white/70 hover:text-cream-white transition-colors px-2 py-1 rounded-md hover:bg-space-dark/40"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {photoURL && (
          <Image
            src={photoURL}
            alt=""
            width={24}
            height={24}
            className="rounded-full"
            unoptimized
          />
        )}
        <span className="text-cream-white/80 truncate max-w-[10rem]">{displayName}</span>
        <span className="text-cream-white/40 text-xs">▾</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 min-w-[10rem] rounded-md border border-space-grey bg-space-dark shadow-lg z-20 overflow-hidden"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onEditNickname()
            }}
            className="w-full text-left px-3 py-2 text-sm text-cream-white/80 hover:bg-space-purple/20 hover:text-cream-white transition-colors"
          >
            Edit nickname
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onSignOut().catch((err) => console.error('Sign out failed:', err))
            }}
            className="w-full text-left px-3 py-2 text-sm text-cream-white/80 hover:bg-space-purple/20 hover:text-cream-white transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
