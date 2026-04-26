'use client'
import { motion } from 'framer-motion'
import React from 'react'

import { getDifficultyMode } from '@/app/tap-tap-adventure/config/difficultyModes'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/types'

interface CharacterCardProps {
  character: FantasyCharacter
  selected?: boolean
  onSelect?: (character: FantasyCharacter) => void
  onDelete?: (e: React.MouseEvent, id: string) => void
  onRetire?: (e: React.MouseEvent, id: string) => void
}

export default function CharacterCard({
  character,
  selected,
  onSelect,
  onDelete,
  onRetire,
}: CharacterCardProps) {
  const canRetire = character.status === 'active' && (character.distance ?? 0) >= 100
  const diffMode = getDifficultyMode(character.difficultyMode ?? 'normal')
  const diffColorMap: Record<string, string> = {
    normal: 'text-indigo-300',
    hard: 'text-red-300',
    ironman: 'text-orange-300',
    casual: 'text-green-300',
  }
  return (
    <motion.div
      whileHover={{ scale: 1.04 }}
      className={`relative flex flex-col items-center justify-between p-4 rounded-lg border transition-colors cursor-pointer focus:outline-none select-none ${selected ? 'ring-2 ring-sky-500' : ''}`}
      onClick={() => onSelect?.(character)}
      tabIndex={0}
    >
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-sky-600 to-indigo-700 flex items-center justify-center mb-3 border border-[#3a3c56] text-white text-2xl font-bold">
        {character.name.slice(0, 2).toUpperCase()}
      </div>
      <div className="text-slate-200 font-semibold text-lg truncate w-full text-center">
        {character.name}
      </div>
      <div className="text-xs text-slate-400 mb-2">
        Lv.{character.level} {character.race} {character.class}
        {diffMode.id !== 'normal' && (
          <span className={`ml-1 ${diffColorMap[diffMode.id] ?? 'text-slate-300'}`}>
            {diffMode.icon}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-300 mt-1 justify-center">
        <span>Gold: {character.gold}</span>
        <span>Rep: {character.reputation}</span>
        <span>STR: {character.strength}</span>
        <span>INT: {character.intelligence}</span>
        <span>LUCK: {character.luck}</span>
        <span>CHA: {character.charisma}</span>
        {(character.deathCount ?? 0) > 0 && (
          <span className="text-red-400">Deaths: {character.deathCount}</span>
        )}
      </div>
      {character.status === 'retired' && (
        <span className="text-xs text-amber-400 mt-1">Retired</span>
      )}
      {character.status === 'dead' && (
        <span className="text-xs text-red-400 mt-1">Dead</span>
      )}
      {onRetire && canRetire && (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            onRetire(e, character.id)
          }}
          className="mt-2 text-xs px-3 py-1 bg-amber-700/50 hover:bg-amber-600/60 text-amber-200 rounded transition-colors focus:outline-none border border-amber-600/40"
          aria-label={`Retire ${character.name}`}
        >
          Retire
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            onDelete(e, character.id)
          }}
          className="absolute top-2 right-2 text-slate-500 hover:text-red-500 transition-colors focus:outline-none text-2xl leading-none p-1"
          aria-label={`Delete ${character.name}`}
        >
          &times;
        </button>
      )}
    </motion.div>
  )
}
