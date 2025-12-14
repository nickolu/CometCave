'use client'
import React from 'react'
import { motion } from 'framer-motion'
import { FantasyCharacter } from '../models/types'

interface CharacterCardProps {
  character: FantasyCharacter
  selected?: boolean
  onSelect?: (character: FantasyCharacter) => void
  onDelete?: (e: React.MouseEvent, id: string) => void
}

export default function CharacterCard({
  character,
  selected,
  onSelect,
  onDelete,
}: CharacterCardProps) {
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
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-300 mt-1 justify-center">
        <span>Gold: {character.gold}</span>
        <span>Rep: {character.reputation}</span>
        <span>STR: {character.strength}</span>
        <span>INT: {character.intelligence}</span>
        <span>LUCK: {character.luck}</span>
      </div>
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
