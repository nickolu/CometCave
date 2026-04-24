'use client'

import React from 'react'
import { LoaderCircle } from 'lucide-react'
import { Button } from './ui/button'
import type { FantasyDecisionPoint, FantasyCharacter } from '@/app/tap-tap-adventure/models/types'

interface TownHubProps {
  townName: string
  townIcon?: string
  decisionPoint: FantasyDecisionPoint
  isResolving: boolean
  character: FantasyCharacter
  onSelectOption: (optionId: string) => void
  statusMessage?: string | null
}

interface FeatureConfig {
  icon: string
  label: string
  className: string
  disabledClassName?: string
  isDisabled?: (option: { id: string; text: string }, character: FantasyCharacter) => boolean
  disabledReason?: (option: { id: string; text: string }, character: FantasyCharacter) => string | null
}

const FEATURE_CONFIGS: Record<string, FeatureConfig> = {
  'visit-shop': {
    icon: '🏪',
    label: 'Visit Shop',
    className:
      'bg-amber-900/40 hover:bg-amber-800/60 border-amber-600/40 text-amber-200 hover:text-amber-100',
  },
  'rest-at-inn': {
    icon: '🛏️',
    label: 'Rest at Inn',
    className:
      'bg-teal-900/40 hover:bg-teal-800/60 border-teal-600/40 text-teal-200 hover:text-teal-100',
    disabledClassName:
      'bg-slate-900/40 border-slate-700/40 text-slate-500 cursor-not-allowed opacity-60',
    isDisabled: (option, character) => {
      const match = option.text.match(/\((\d+) gold\)/)
      if (!match) return false
      const cost = parseInt(match[1], 10)
      return character.gold < cost
    },
    disabledReason: (option, character) => {
      const match = option.text.match(/\((\d+) gold\)/)
      if (!match) return null
      const cost = parseInt(match[1], 10)
      if (character.gold < cost) return `Need ${cost} gold (have ${character.gold})`
      return null
    },
  },
  'hire-transport': {
    icon: '🐴',
    label: 'Hire Transport',
    className:
      'bg-blue-900/40 hover:bg-blue-800/60 border-blue-600/40 text-blue-200 hover:text-blue-100',
  },
  'visit-stable': {
    icon: '🐴',
    label: 'Visit Stable',
    className:
      'bg-amber-950/40 hover:bg-amber-900/60 border-amber-700/40 text-amber-300 hover:text-amber-200',
  },
  'check-mailbox': {
    icon: '📬',
    label: 'Check Mailbox',
    className:
      'bg-purple-900/40 hover:bg-purple-800/60 border-purple-600/40 text-purple-200 hover:text-purple-100',
  },
}

export function TownHub({
  townName,
  townIcon = '🏘️',
  decisionPoint,
  isResolving,
  character,
  onSelectOption,
}: TownHubProps) {
  const mainOptions = decisionPoint.options.filter(o => o.id !== 'leave-town')
  const leaveOption = decisionPoint.options.find(o => o.id === 'leave-town')

  return (
    <div className="rounded-xl border border-[#3a3c56] bg-[#1e1f30] overflow-hidden">
      {/* Town Header */}
      <div className="px-4 py-3 bg-[#16172a] border-b border-[#3a3c56] flex items-center gap-3">
        <span className="text-3xl leading-none">{townIcon}</span>
        <div>
          <h2 className="text-lg font-bold text-white leading-tight">{townName}</h2>
          <p className="text-xs text-slate-400">Town Hub</p>
        </div>
        {isResolving && (
          <LoaderCircle className="ml-auto animate-spin h-5 w-5 text-indigo-400" />
        )}
      </div>

      {/* Status / prompt area */}
      {decisionPoint.prompt && (
        <div className="px-4 py-3 bg-[#181929] border-b border-[#2a2c42]">
          <p className="text-sm text-slate-300 leading-relaxed">{decisionPoint.prompt}</p>
        </div>
      )}

      {/* Character quick-stats */}
      <div className="px-4 py-2 flex gap-4 bg-[#1a1b2c] border-b border-[#2a2c42]">
        <span className="text-xs text-slate-400">
          <span className="text-red-400 font-semibold">❤️ {character.hp ?? character.maxHp ?? '?'}</span>
          <span className="text-slate-600"> / {character.maxHp ?? '?'}</span>
        </span>
        <span className="text-xs text-yellow-400 font-semibold">🪙 {character.gold} gold</span>
      </div>

      {/* Feature buttons */}
      <div className="p-4 space-y-2">
        {mainOptions.map(option => {
          const config = FEATURE_CONFIGS[option.id]
          const icon = config?.icon ?? '✨'
          const disabled =
            isResolving ||
            (config?.isDisabled ? config.isDisabled(option, character) : false)
          const disabledReason = config?.disabledReason
            ? config.disabledReason(option, character)
            : null
          const className = disabled && config?.disabledClassName
            ? config.disabledClassName
            : config?.className ?? 'bg-indigo-900/40 hover:bg-indigo-800/60 border-indigo-600/40 text-indigo-200 hover:text-indigo-100'

          return (
            <div key={option.id}>
              <button
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors text-left ${className}`}
                onClick={() => !disabled && onSelectOption(option.id)}
                disabled={disabled}
              >
                <span className="text-xl leading-none flex-shrink-0">{icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm leading-tight">{option.text}</div>
                  {disabledReason && (
                    <div className="text-xs mt-0.5 text-slate-500">{disabledReason}</div>
                  )}
                </div>
              </button>
            </div>
          )
        })}

        {/* Divider before leave */}
        {leaveOption && (
          <>
            <div className="border-t border-[#2a2c42] my-3" />
            <button
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors text-left ${
                isResolving
                  ? 'bg-slate-900/40 border-slate-700/40 text-slate-500 cursor-not-allowed opacity-60'
                  : 'bg-slate-900/30 hover:bg-slate-800/50 border-slate-600/30 text-slate-300 hover:text-slate-100'
              }`}
              onClick={() => !isResolving && onSelectOption(leaveOption.id)}
              disabled={isResolving}
            >
              <span className="text-xl leading-none flex-shrink-0">🚪</span>
              <div className="font-semibold text-sm">{leaveOption.text}</div>
            </button>
          </>
        )}
      </div>
    </div>
  )
}
