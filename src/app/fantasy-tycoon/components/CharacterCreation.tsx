'use client'
import React from 'react'
import { useCharacterCreation } from '../hooks/useCharacterCreation'
import { useCallback } from 'react'

import { FantasyCharacter } from '../models/types'

export default function CharacterCreation({
  onComplete,
}: {
  onComplete?: (character: Partial<FantasyCharacter>) => void
}) {
  const { character, updateCharacter, completeCreation } = useCharacterCreation()

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      completeCreation()
      onComplete?.(character)
    },
    [completeCreation, character, onComplete]
  )

  return (
    <form className="space-y-6 p-1" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="characterName" className="block text-sm font-medium text-slate-300 mb-1">
          Character Name
        </label>
        <input
          id="characterName"
          type="text"
          className="w-full p-3 bg-slate-800/60 border border-[#3a3c56] rounded-md text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors shadow-sm"
          placeholder="E.g., Aragorn, Gandalf"
          value={character.name || ''}
          onChange={e => updateCharacter({ name: e.target.value })}
          required
          autoFocus
        />
      </div>
      {/* Placeholder for potential future fields like race/class selection */}
      {/* <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="characterRace" className="block text-sm font-medium text-slate-300 mb-1">Race</label>
          <select id="characterRace" className="w-full p-3 bg-slate-800/60 border border-[#3a3c56] rounded-md text-slate-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors">
            <option>Human</option>
            <option>Elf</option>
            <option>Dwarf</option>
          </select>
        </div>
        <div>
          <label htmlFor="characterClass" className="block text-sm font-medium text-slate-300 mb-1">Class</label>
          <select id="characterClass" className="w-full p-3 bg-slate-800/60 border border-[#3a3c56] rounded-md text-slate-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors">
            <option>Warrior</option>
            <option>Mage</option>
            <option>Rogue</option>
          </select>
        </div>
      </div> */}
      <button
        type="submit"
        className="w-full bg-sky-600 hover:bg-sky-700 text-white font-semibold px-4 py-3 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-[#161723] shadow-md"
      >
        Create Character
      </button>
    </form>
  )
}
