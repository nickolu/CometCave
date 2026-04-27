'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

import { useAuth } from '@/app/trivia/hooks/useAuth'
import { useTriviaStore } from '@/app/trivia/hooks/useTriviaStore'
import { useTriviaUser } from '@/app/trivia/hooks/useTriviaUser'
import { formatDisplayDate, getDailyCategory, getTodayPST } from '@/app/trivia/lib/triviaUtils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { NamePrompt } from './NamePrompt'

export function TriviaLanding({
  onStartGame,
  onViewStats,
  onViewLeaderboard,
}: {
  onStartGame?: () => void
  onViewStats?: () => void
  onViewLeaderboard?: () => void
}) {
  const { userData: localUser, canPlayToday: canPlayLocal, setDisplayName, skipName } =
    useTriviaStore()
  const {
    userData: firestoreUser,
    canPlayToday: canPlayFirestore,
    loading: firestoreLoading,
  } = useTriviaUser()
  const { user, loading: authLoading, configured: authConfigured } = useAuth()
  const [showChangeName, setShowChangeName] = useState(false)

  const stats = user ? firestoreUser.stats : localUser.stats
  const todayStr = getTodayPST()
  const todayHistoryEntry = user
    ? firestoreUser.history.find((h) => h.date === todayStr) ?? null
    : localUser.history.find((h) => h.date === todayStr) ?? null
  const alreadyPlayed = user ? !canPlayFirestore() : !canPlayLocal()
  const showNamePrompt = !user && !localUser.displayName && !localUser.nameSkipped
  const showPlayingAs = !user && !!localUser.displayName
  const showFirestoreLoadingHint = !!user && firestoreLoading
  const category = getDailyCategory(todayStr)

  return (
    <div className="flex flex-col items-center gap-6 max-w-lg mx-auto py-8">
      <div className="w-full flex justify-end min-h-[1.25rem] text-sm">
        {!authConfigured ? null : authLoading ? null : user ? (
          <div className="flex items-center gap-2 text-cream-white/70">
            {user.photoURL && (
              <Image
                src={user.photoURL}
                alt=""
                width={24}
                height={24}
                className="rounded-full"
                unoptimized
              />
            )}
            <span className="text-cream-white/80 truncate max-w-[10rem]">
              {user.displayName ?? user.email}
            </span>
          </div>
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
        <h1 className="text-4xl font-bold text-space-gold mb-2">Daily Trivia</h1>
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

      {showNamePrompt ? (
        <NamePrompt onSave={setDisplayName} onSkip={skipName} />
      ) : showPlayingAs && !showChangeName ? (
        <div className="w-full text-center text-cream-white/60 text-sm">
          Playing as{' '}
          <span className="text-space-gold font-semibold">{localUser.displayName}</span>
          {' · '}
          <button
            onClick={() => setShowChangeName(true)}
            className="text-space-gold/70 hover:text-space-gold hover:underline underline-offset-4 transition-colors"
          >
            change
          </button>
        </div>
      ) : showChangeName ? (
        <NamePrompt
          showSkip={false}
          initialName={localUser.displayName ?? ''}
          title="Change display name"
          onSave={(name) => { setDisplayName(name); setShowChangeName(false) }}
          onSkip={() => setShowChangeName(false)}
        />
      ) : null}

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

          {alreadyPlayed && todayHistoryEntry && (
            <div className="text-center text-cream-white/60 text-sm">
              Today&apos;s score:{' '}
              <span className="text-space-gold font-semibold">
                {todayHistoryEntry.score} pts
              </span>
              {' · '}
              {todayHistoryEntry.correct}/{todayHistoryEntry.total} correct
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
    </div>
  )
}
