'use client'
import { useMemo } from 'react'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/fantasy-tycoon/components/ui/tooltip'

import { useGameStore } from '../hooks/useGameStore'
import { FantasyCharacter } from '../models/character'

type IconType =
  | 'sunIcon'
  | 'waterDropIcon'
  | 'leafIcon'
  | 'fireIcon'
  | 'purpleCircleIcon'
  | 'blueCircleIcon'
  | 'yellowMoonIcon'

const ICONS: Record<IconType, React.ReactNode> = {
  sunIcon: (
    <svg width="20" height="20" fill="#FACC15" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="8" />
    </svg>
  ),
  waterDropIcon: (
    <svg width="20" height="20" fill="#60A5FA" viewBox="0 0 20 20">
      <path d="M10 2c-4.418 0-8 3.582-8 8 0 2.665 1.323 5.023 3.34 6.497L10 20l4.66-3.503A7.963 7.963 0 0018 10c0-4.418-3.582-8-8-8z" />
    </svg>
  ),
  leafIcon: (
    <svg width="20" height="20" fill="#4ADE80" viewBox="0 0 20 20">
      <path d="M10 2C6.94 .746 4.62.063 2.5 3.5c-1.25 2 0 4.5 0 4.5S4.5 17.5 10 17.5s7.5-9.5 7.5-9.5S13.75.746 10 2z" />
    </svg>
  ),
  fireIcon: (
    <svg width="20" height="20" fill="#F97316" viewBox="0 0 20 20">
      <path d="M10.5 0C7.286.057 4.536 2.018 4.536 5.714 4.536 9.07 7.071 11.25 7.071 12.5c0 .964-1.071 3.75-1.071 3.75s1.071.893 3.5.893c2.679 0 3.5-1.25 3.5-1.25s-1.071-2.679-1.071-3.75C12.429 11.25 15 9.07 15 5.714 15 2.018 12.714.057 10.5 0z" />
    </svg>
  ),
  purpleCircleIcon: (
    <svg width="20" height="20" fill="#A78BFA" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="8" />
    </svg>
  ),
  blueCircleIcon: (
    <svg width="20" height="20" fill="#3B82F6" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="8" />
    </svg>
  ),
  yellowMoonIcon: (
    <svg width="20" height="20" fill="#FACC15" viewBox="0 0 20 20">
      <path d="M10 20C4.477 20 0 15.523 0 10S4.477 0 10 0c.34 0 .674.02 1 .058A8.001 8.001 0 0110 4a8 8 0 01-2.928 6A8.001 8.001 0 011 10c.02.326.04.66.058 1A10.004 10.004 0 0010 20z" />
    </svg>
  ),
} as const

const STAT_LABELS: Record<IconType, string> = {
  sunIcon: 'Gold',
  waterDropIcon: 'Reputation',
  leafIcon: 'Distance',
  fireIcon: 'Level',
  purpleCircleIcon: 'Strength',
  blueCircleIcon: 'Intelligence',
  yellowMoonIcon: 'Luck',
} as const

const STATS_LEFT: IconType[] = ['sunIcon', 'waterDropIcon', 'leafIcon', 'fireIcon']
const STATS_RIGHT: IconType[] = ['purpleCircleIcon', 'blueCircleIcon', 'yellowMoonIcon']

export function HudBar() {
  const { gameState } = useGameStore()
  const character = gameState?.characters?.find(
    (char: FantasyCharacter) => char.id === gameState?.selectedCharacterId
  )

  const stats = useMemo(
    () => ({
      sunIcon: character?.gold ?? 0,
      waterDropIcon: character?.reputation ?? 0,
      leafIcon: character?.distance ?? 0,
      fireIcon: character?.level ?? 1,
      purpleCircleIcon: character?.strength ?? 0,
      blueCircleIcon: character?.intelligence ?? 0,
      yellowMoonIcon: character?.luck ?? 0,
    }),
    [character]
  ) as Record<IconType, number>

  return (
    <TooltipProvider>
      <div className="w-full flex justify-between items-center gap-4 px-4 py-2 rounded-lg shadow-md bg-[#161723] border border-[#3a3c56] text-white">
        <div className="flex items-center gap-4">
          {STATS_LEFT.map(key => (
            <Tooltip key={key}>
              <TooltipTrigger className="flex items-center gap-1 text-sm font-semibold">
                <span className="inline-block align-middle">{ICONS[key]}</span>
                <span>{stats[key]}</span>
              </TooltipTrigger>
              <TooltipContent>{STAT_LABELS[key]}</TooltipContent>
            </Tooltip>
          ))}
        </div>

        <div className="flex items-center gap-4">
          {STATS_RIGHT.map((key: IconType) => (
            <Tooltip key={key}>
              <TooltipTrigger className="flex items-center gap-1 text-sm font-semibold">
                <span className="inline-block align-middle">{ICONS[key]}</span>
                <span>{stats[key]}</span>
              </TooltipTrigger>
              <TooltipContent>{STAT_LABELS[key]}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </TooltipProvider>
  )
}
