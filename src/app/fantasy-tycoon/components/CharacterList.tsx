'use client'
import React, { useState } from 'react'
import { useGameStore } from '../hooks/useGameStore'
import { FantasyCharacter } from '../models/types'
import CharacterCreation from './CharacterCreation'
import CharacterCard from './CharacterCard'
import AddCharacterCard from './AddCharacterCard'

import type { GameStore } from '../hooks/useGameStore'
const EMPTY_ARRAY: FantasyCharacter[] = []
const selectCharacters = (s: GameStore) => s.gameState?.characters ?? EMPTY_ARRAY
const selectSelectedCharacterId = (s: GameStore) => s.gameState?.selectedCharacterId
const selectSelectCharacter = (s: GameStore) => s.selectCharacter
const selectDeleteCharacter = (s: GameStore) => s.deleteCharacter

export default function CharacterList() {
  const characters = useGameStore(selectCharacters)
  const selectedCharacterId = useGameStore(selectSelectedCharacterId)
  const selectCharacter = useGameStore(selectSelectCharacter)
  const deleteCharacter = useGameStore(selectDeleteCharacter)
  const [showCreation, setShowCreation] = useState(false)

  const handleSelect = (character: FantasyCharacter) => {
    selectCharacter(character.id)
  }

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    deleteCharacter(id)
  }

  const handleNewCharacter = () => {
    setShowCreation(true)
  }

  const handleCloseCreation = () => {
    setShowCreation(false)
  }

  return (
    <div className="w-full mx-auto p-6 p-4 bg-[#161723] border border-[#3a3c56] rounded-lg mt-6">
      <h2 className="text-2xl font-semibold mb-6 text-slate-200">Your Characters</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {characters.map((char: FantasyCharacter) => (
          <CharacterCard
            key={char.id}
            character={char}
            selected={selectedCharacterId === char.id}
            onSelect={handleSelect}
            onDelete={handleDelete}
          />
        ))}
        {characters.length < 5 && <AddCharacterCard onClick={handleNewCharacter} />}
      </div>
      {showCreation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#161723] border border-[#3a3c56] rounded-lg p-6 shadow-2xl w-full max-w-md relative">
            <button
              type="button"
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-200 transition-colors text-3xl leading-none font-semibold"
              onClick={handleCloseCreation}
              aria-label="Close"
            >
              &times;
            </button>
            <CharacterCreation onComplete={handleCloseCreation} />
          </div>
        </div>
      )}
    </div>
  )
}
