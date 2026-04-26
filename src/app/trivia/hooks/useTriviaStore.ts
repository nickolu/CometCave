'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TriviaUserData, TriviaGameResult } from '../models/trivia'
import { getTodayPST, hasPlayedToday } from '../lib/triviaUtils'

const defaultUserData: TriviaUserData = {
  displayName: null,
  nameSkipped: false,
  stats: {
    gamesPlayed: 0,
    totalScore: 0,
    totalCorrect: 0,
    totalQuestions: 0,
    currentStreak: 0,
    bestStreak: 0,
    weeklyWins: 0,
  },
  history: [],
  lastPlayedDate: null,
}

interface TriviaStore {
  userData: TriviaUserData
  canPlayToday: () => boolean
  setDisplayName: (name: string) => void
  skipName: () => void
  recordGame: (result: TriviaGameResult) => void
  resetStats: () => void
}

export const useTriviaStore = create<TriviaStore>()(
  persist(
    (set, get) => ({
      userData: defaultUserData,

      canPlayToday: () => {
        return !hasPlayedToday(get().userData.lastPlayedDate)
      },

      setDisplayName: (name: string) => {
        set((state) => ({
          userData: { ...state.userData, displayName: name, nameSkipped: false },
        }))
      },

      skipName: () => {
        set((state) => ({
          userData: { ...state.userData, nameSkipped: true },
        }))
      },

      recordGame: (result: TriviaGameResult) => {
        set((state) => {
          const today = getTodayPST()
          const yesterday = (() => {
            const d = new Date()
            d.setDate(d.getDate() - 1)
            const pst = new Date(d.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
            const yyyy = pst.getFullYear()
            const mm = String(pst.getMonth() + 1).padStart(2, '0')
            const dd = String(pst.getDate()).padStart(2, '0')
            return `${yyyy}-${mm}-${dd}`
          })()

          const wasYesterday = state.userData.lastPlayedDate === yesterday
          const newStreak = wasYesterday ? state.userData.stats.currentStreak + 1 : 1
          const bestStreak = Math.max(newStreak, state.userData.stats.bestStreak)

          return {
            userData: {
              ...state.userData,
              lastPlayedDate: today,
              stats: {
                ...state.userData.stats,
                gamesPlayed: state.userData.stats.gamesPlayed + 1,
                totalScore: state.userData.stats.totalScore + result.score,
                totalCorrect: state.userData.stats.totalCorrect + result.correct,
                totalQuestions: state.userData.stats.totalQuestions + result.total,
                currentStreak: newStreak,
                bestStreak,
              },
              history: state.userData.displayName ? [...state.userData.history, result] : state.userData.history,
            },
          }
        })
      },

      resetStats: () => {
        set({ userData: defaultUserData })
      },
    }),
    {
      name: 'cometcave-trivia-user',
      version: 2,
      migrate: (persistedState: unknown, version: number) => {
        if (version < 2) {
          const state = persistedState as { userData: TriviaUserData }
          return { ...state, userData: { ...state.userData, nameSkipped: false } }
        }
        return persistedState
      },
    }
  )
)
