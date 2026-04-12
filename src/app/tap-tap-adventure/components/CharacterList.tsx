'use client'
import React, { useState } from 'react'

import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import type { GameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/types'

import AddCharacterCard from './AddCharacterCard'
import CharacterCard from './CharacterCard'
import CharacterCreation from './CharacterCreation'

const EMPTY_ARRAY: FantasyCharacter[] = []
const selectCharacters = (s: GameStore) => s.gameState?.characters ?? EMPTY_ARRAY
const selectSelectedCharacterId = (s: GameStore) => s.gameState?.selectedCharacterId
const selectSelectCharacter = (s: GameStore) => s.selectCharacter
const selectDeleteCharacter = (s: GameStore) => s.deleteCharacter
const selectRetireCharacter = (s: GameStore) => s.retireCharacter
const selectLegacyHeirlooms = (s: GameStore) => s.gameState?.legacyHeirlooms ?? EMPTY_ARRAY

export default function CharacterList() {
  const characters = useGameStore(selectCharacters)
  const selectedCharacterId = useGameStore(selectSelectedCharacterId)
  const selectCharacter = useGameStore(selectSelectCharacter)
  const deleteCharacter = useGameStore(selectDeleteCharacter)
  const retireCharacter = useGameStore(selectRetireCharacter)
  const legacyHeirlooms = useGameStore(selectLegacyHeirlooms)
  const [showCreation, setShowCreation] = useState(false)

  const handleSelect = (character: FantasyCharacter) => {
    selectCharacter(character.id)
  }

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    deleteCharacter(id)
  }

  const handleRetire = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (window.confirm('Are you sure you want to retire this character? They will leave behind an heirloom for future characters.')) {
      retireCharacter(id)
    }
  }

  const handleNewCharacter = () => {
    setShowCreation(true)
  }

  const handleCloseCreation = () => {
    setShowCreation(false)
  }

  return (
    <div className="w-full mx-auto p-6 p-4 bg-[#161723] border border-[#3a3c56] rounded-lg mt-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-slate-200">Your Characters</h2>
        {legacyHeirlooms.length > 0 && (
          <span className="text-sm text-amber-400 bg-amber-900/30 border border-amber-600/40 px-3 py-1 rounded-full">
            Legacy Items: {legacyHeirlooms.length}
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {characters.map((char: FantasyCharacter) => (
          <CharacterCard
            key={char.id}
            character={char}
            selected={selectedCharacterId === char.id}
            onSelect={handleSelect}
            onDelete={handleDelete}
            onRetire={handleRetire}
          />
        ))}
        {characters.length < 5 && <AddCharacterCard onClick={handleNewCharacter} />}
      </div>
      {showCreation && (
        <div className="mt-6 bg-[#1e1f30] border border-[#3a3c56] rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-200">Create Character</h3>
            <button
              type="button"
              className="text-slate-400 hover:text-slate-200 transition-colors text-2xl leading-none font-semibold"
              onClick={handleCloseCreation}
              aria-label="Close"
            >
              &times;
            </button>
          </div>
          <CharacterCreation onComplete={handleCloseCreation} />
        </div>
      )}
    </div>
  )
}
