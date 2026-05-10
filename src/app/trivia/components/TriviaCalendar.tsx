'use client'

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { useState } from 'react'

import { useTriviaUser } from '@/app/trivia/hooks/useTriviaUser'
import { ChunkyCard, ChunkyCardContent, ChunkyCardHeader, ChunkyCardTitle } from '@/components/ui/chunky-card'
import { getTodayPST } from '@/lib/dates'
import { getDailyCategory } from '@/lib/trivia/categories'

import { TriviaFooter } from './TriviaFooter'

import type { TriviaNav } from './TriviaFooter'

interface TriviaCalendarProps {
  onPlayToday: () => void
  onSelectDate: (date: string) => void
  onBack: () => void
  nav: TriviaNav
}

type DayStatus = 'played' | 'missed' | 'today' | 'future'

function toDateObj(dateStr: string): Date {
  return new Date(dateStr + 'T12:00:00')
}

export function TriviaCalendar({ onPlayToday, onSelectDate, onBack, nav }: TriviaCalendarProps) {
  const { history } = useTriviaUser()
  const todayStr = getTodayPST()
  const todayDate = toDateObj(todayStr)

  const [viewDate, setViewDate] = useState(() => startOfMonth(todayDate))

  const playedSet = new Set(history.map((r) => r.date))
  const retroactiveSet = new Set(history.filter((r) => r.isRetroactive).map((r) => r.date))

  const monthStart = startOfMonth(viewDate)
  const monthEnd = endOfMonth(viewDate)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd })

  function getDayStatus(day: Date): DayStatus {
    const str = format(day, 'yyyy-MM-dd')
    if (str === todayStr) return 'today'
    if (isAfter(day, todayDate)) return 'future'
    if (playedSet.has(str)) return 'played'
    return 'missed'
  }

  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const playedThisMonth = daysInMonth.filter((d) => playedSet.has(format(d, 'yyyy-MM-dd'))).length
  const pastDaysThisMonth = daysInMonth.filter((d) => !isAfter(d, todayDate)).length

  const isCurrentMonth = format(viewDate, 'yyyy-MM') === format(todayDate, 'yyyy-MM')

  function handleDayClick(day: Date, status: DayStatus) {
    if (status === 'today') {
      onPlayToday()
    } else if (status === 'missed') {
      onSelectDate(format(day, 'yyyy-MM-dd'))
    }
  }

  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="flex flex-col items-center gap-6 max-w-lg mx-auto py-8">
      <div className="w-full flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-ds-tertiary hover:text-ds-tertiary/80 transition-colors text-sm underline-offset-4 hover:underline"
        >
          ← Back
        </button>
        <h1 className="font-headline text-headline-lg text-ds-tertiary">Calendar</h1>
        <div className="w-16" />
      </div>

      <ChunkyCard variant="surface-container-high" className="w-full">
        <ChunkyCardHeader>
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={() => setViewDate((d) => subMonths(d, 1))}
              className="text-on-surface/60 hover:text-on-surface transition-colors px-2 py-1 rounded"
              aria-label="Previous month"
            >
              ‹
            </button>
            <ChunkyCardTitle className="text-on-surface text-center">
              {format(viewDate, 'MMMM yyyy')}
            </ChunkyCardTitle>
            <button
              type="button"
              onClick={() => setViewDate((d) => addMonths(d, 1))}
              disabled={isCurrentMonth}
              className="text-on-surface/60 hover:text-on-surface transition-colors px-2 py-1 rounded disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Next month"
            >
              ›
            </button>
          </div>
        </ChunkyCardHeader>
        <ChunkyCardContent>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAY_LABELS.map((label) => (
              <div
                key={label}
                className="text-center text-xs text-on-surface/40 font-medium py-1"
              >
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {allDays.map((day) => {
              const str = format(day, 'yyyy-MM-dd')
              const inMonth = isSameMonth(day, viewDate)
              const status = getDayStatus(day)
              const category = status === 'played' || status === 'today' ? getDailyCategory(str) : null

              const isRetro = retroactiveSet.has(str)
              const isClickable = inMonth && (status === 'today' || status === 'missed')

              const cellBase =
                'relative flex flex-col items-center justify-center rounded-lg aspect-square text-xs transition-colors'

              const cellStyle =
                !inMonth
                  ? 'opacity-20'
                  : status === 'played'
                    ? 'bg-ds-tertiary/20 text-ds-tertiary'
                    : status === 'today'
                      ? 'bg-ds-tertiary text-surface-container ring-2 ring-ds-tertiary ring-offset-1'
                      : status === 'missed'
                        ? 'bg-surface-variant/30 text-on-surface border border-outline-variant/40 hover:bg-surface-variant/50 cursor-pointer'
                        : 'text-on-surface/30'

              return (
                <button
                  key={str}
                  type="button"
                  disabled={!isClickable}
                  onClick={() => isClickable && handleDayClick(day, status)}
                  className={`${cellBase} ${cellStyle} ${!isClickable ? 'cursor-default' : ''}`}
                  aria-label={
                    status === 'today'
                      ? `Today, ${format(day, 'MMMM d')} — play now`
                      : status === 'missed'
                        ? `${format(day, 'MMMM d')} — missed`
                        : status === 'played'
                          ? `${format(day, 'MMMM d')} — played${isRetro ? ' (retroactive)' : ''}`
                          : format(day, 'MMMM d')
                  }
                >
                  {status === 'played' && category && (
                    <span className="text-base leading-none mb-0.5">{category.icon}</span>
                  )}
                  <span className={status === 'played' ? 'text-[10px]' : 'font-medium'}>
                    {format(day, 'd')}
                  </span>
                  {status === 'today' && (
                    <span className="text-[8px] leading-none mt-0.5 font-bold uppercase tracking-wide opacity-80">
                      Today
                    </span>
                  )}
                  {status === 'played' && isRetro && (
                    <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-yellow-400/70" title="Played retroactively" />
                  )}
                </button>
              )
            })}
          </div>

          <div className="mt-4 text-center text-sm text-on-surface/60 border-t border-outline-variant/20 pt-3">
            Played{' '}
            <span className="text-ds-tertiary font-semibold">{playedThisMonth}</span>
            {' / '}
            {pastDaysThisMonth} days this month
          </div>

          <div className="mt-3 flex items-center justify-center gap-4 text-xs text-on-surface/50 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-ds-tertiary/20 inline-block" />
              Played
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-ds-tertiary inline-block" />
              Today
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-surface-variant/30 border border-outline-variant/40 inline-block" />
              Missed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="relative w-3 h-3 rounded bg-ds-tertiary/20 inline-block">
                <span className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-yellow-400/70" />
              </span>
              Retroactive
            </span>
          </div>
        </ChunkyCardContent>
      </ChunkyCard>

      <TriviaFooter current="calendar" {...nav} />
    </div>
  )
}
