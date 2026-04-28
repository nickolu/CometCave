'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { useTriviaUser } from '@/app/trivia/hooks/useTriviaUser'
import type { TriviaGameResult } from '@/app/trivia/models/trivia'
import { ChunkyButton } from '@/components/ui/chunky-button'
import { ChunkyCard, ChunkyCardContent, ChunkyCardHeader, ChunkyCardTitle } from '@/components/ui/chunky-card'
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
            className="text-ds-tertiary/80 hover:text-ds-tertiary underline-offset-4 hover:underline transition-colors"
          >
            Sign in
          </Link>
        )}
      </div>

      <div className="text-center">
        <h1 className="font-headline text-headline-lg text-ds-tertiary drop-shadow-[0_4px_0_var(--surface-container-lowest)] mb-2 inline-flex items-center gap-2">
          Daily Trivia
          <ResetNoticeButton />
        </h1>
        <p className="text-on-surface/70 text-lg">{formatDisplayDate(todayStr)}</p>
      </div>

      {/* Today's Theme banner */}
      <div className="w-full flex flex-col items-center gap-1 px-4 py-3 rounded-lg bg-gradient-to-r from-surface-variant/30 to-ds-tertiary/20 border border-ds-tertiary/30">
        <div className="text-on-surface/60 text-xs uppercase tracking-widest">Today&apos;s Theme</div>
        <div className="flex items-center gap-2 text-xl font-bold text-ds-tertiary">
          <span className="text-2xl">{category.icon}</span>
          <span>{category.name}</span>
        </div>
      </div>

      {/* Streak hero (logged-in users with an active streak) */}
      {user && stats.currentStreak > 0 && (
        <div className="w-full flex items-center justify-center gap-2 text-on-surface/80">
          <span className="text-2xl">🔥</span>
          <span className="text-lg">
            <span className="text-ds-tertiary font-bold text-2xl">{stats.currentStreak}</span>
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
          className="w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-surface-variant/15 border border-surface-variant/30 text-sm text-left hover:bg-surface-variant/20 transition-colors"
        >
          <span className="text-on-surface/80">
            Pick a nickname for the leaderboard
          </span>
          <span className="text-ds-tertiary whitespace-nowrap font-semibold">
            Set nickname →
          </span>
        </button>
      )}

      <ChunkyCard variant="surface-container-high" className="w-full">
        <ChunkyCardHeader>
          <ChunkyCardTitle className="text-on-surface text-center">
            {showFirestoreLoadingHint
              ? 'Loading your progress…'
              : alreadyPlayed
                ? "You've already played today!"
                : 'Ready to test your knowledge?'}
          </ChunkyCardTitle>
        </ChunkyCardHeader>
        <ChunkyCardContent className="flex flex-col items-center gap-4">
          <ChunkyButton
            variant="primary"
            size="hero"
            className="w-full"
            disabled={alreadyPlayed || showFirestoreLoadingHint}
            onClick={onStartGame}
          >
            {alreadyPlayed ? 'Come Back Tomorrow' : "Start Today's Trivia"}
          </ChunkyButton>

          {alreadyPlayed && todayResult && (
            <div className="text-center text-on-surface/60 text-sm">
              Today&apos;s score:{' '}
              <span className="text-ds-tertiary font-semibold">
                {todayResult.score} pts
              </span>
              {' · '}
              {todayResult.correct}/{todayResult.total} correct
            </div>
          )}
        </ChunkyCardContent>
      </ChunkyCard>

      {/* Streak & Stats */}
      <div className="grid grid-cols-2 gap-4 w-full">
        <ChunkyCard variant="surface-variant">
          <ChunkyCardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-ds-tertiary">{stats.currentStreak}</div>
            <div className="text-on-surface/60 text-sm">Current Streak</div>
          </ChunkyCardContent>
        </ChunkyCard>
        <ChunkyCard variant="surface-variant">
          <ChunkyCardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-on-surface-variant">{stats.bestStreak}</div>
            <div className="text-on-surface/60 text-sm">Best Streak</div>
          </ChunkyCardContent>
        </ChunkyCard>
        <ChunkyCard variant="surface-variant">
          <ChunkyCardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-on-surface">{stats.gamesPlayed}</div>
            <div className="text-on-surface/60 text-sm">Games Played</div>
          </ChunkyCardContent>
        </ChunkyCard>
        <ChunkyCard variant="surface-variant">
          <ChunkyCardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-on-surface">
              {stats.totalQuestions > 0
                ? Math.round((stats.totalCorrect / stats.totalQuestions) * 100)
                : 0}
              %
            </div>
            <div className="text-on-surface/60 text-sm">Accuracy</div>
          </ChunkyCardContent>
        </ChunkyCard>
      </div>

      {/* Links */}
      <div className="flex gap-3 text-sm">
        <button
          onClick={onViewStats}
          className="text-ds-tertiary hover:text-ds-tertiary/80 transition-colors underline-offset-4 hover:underline"
        >
          My Stats
        </button>
        <span className="text-on-surface/20">·</span>
        <button
          onClick={onViewLeaderboard}
          className="text-ds-tertiary hover:text-ds-tertiary/80 transition-colors underline-offset-4 hover:underline"
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
        className="flex items-center gap-2 text-on-surface/70 hover:text-on-surface transition-colors px-2 py-1 rounded-md hover:bg-surface-container/40"
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
        <span className="text-on-surface/80 truncate max-w-[10rem]">{displayName}</span>
        <span className="text-on-surface/40 text-xs">▾</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 min-w-[10rem] rounded-md border border-outline-variant bg-surface-container shadow-lg z-20 overflow-hidden"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onEditNickname()
            }}
            className="w-full text-left px-3 py-2 text-sm text-on-surface/80 hover:bg-surface-variant/20 hover:text-on-surface transition-colors"
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
            className="w-full text-left px-3 py-2 text-sm text-on-surface/80 hover:bg-surface-variant/20 hover:text-on-surface transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
