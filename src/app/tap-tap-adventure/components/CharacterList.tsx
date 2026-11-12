'use client'
import React, { useState } from 'react'

import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import type { GameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/types'
import { CloseIcon } from '@/app/tap-tap-adventure/stage/icons'
import { Placard, PlaybillCaption, PlaybillSheet } from '@/app/tap-tap-adventure/stage/Playbill'

import AddCharacterCard from './AddCharacterCard'
import CharacterCard from './CharacterCard'
import CharacterCreation from './CharacterCreation'
import MetaProgression from './MetaProgression'

const EMPTY_ARRAY: FantasyCharacter[] = []
const selectCharacters = (s: GameStore) => s.gameState?.characters ?? EMPTY_ARRAY
const selectSelectedCharacterId = (s: GameStore) => s.gameState?.selectedCharacterId
const selectSelectCharacter = (s: GameStore) => s.selectCharacter
const selectDeleteCharacter = (s: GameStore) => s.deleteCharacter
const selectRetireCharacter = (s: GameStore) => s.retireCharacter
const selectLegacyHeirlooms = (s: GameStore) => s.gameState?.legacyHeirlooms ?? EMPTY_ARRAY
const selectMetaProgression = (s: GameStore) => s.gameState?.metaProgression

interface CharacterListProps {
  defaultShowCreation?: boolean
  onCreationShown?: () => void
}

export default function CharacterList({ defaultShowCreation, onCreationShown }: CharacterListProps) {
  const characters = useGameStore(selectCharacters)
  const selectedCharacterId = useGameStore(selectSelectedCharacterId)
  const selectCharacter = useGameStore(selectSelectCharacter)
  const deleteCharacter = useGameStore(selectDeleteCharacter)
  const retireCharacter = useGameStore(selectRetireCharacter)
  const legacyHeirlooms = useGameStore(selectLegacyHeirlooms)
  const metaProgression = useGameStore(selectMetaProgression)
  const [showCreation, setShowCreation] = useState(defaultShowCreation ?? false)
  const [showMetaProgression, setShowMetaProgression] = useState(false)

  // If defaultShowCreation was set from the parent, clear the flag
  React.useEffect(() => {
    if (defaultShowCreation && onCreationShown) {
      onCreationShown()
    }
  }, [defaultShowCreation, onCreationShown])

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
    <section className="w-full" aria-label="Your characters">
      {/* the brass-ruled band above the posters */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b-2 border-ps-brass-deep pb-3">
        <h2 className="font-playbill text-xl uppercase tracking-widest text-ps-brass-light sm:text-2xl">Your characters</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowMetaProgression(true)}
            className="inline-flex h-8 items-center gap-2 rounded-[3px] border border-ps-brass-deep bg-ps-brass/15 px-2.5 font-label text-xs font-bold uppercase tracking-widest text-ps-brass-light transition-colors hover:bg-ps-brass/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
          >
            Eternal upgrades
            {(metaProgression?.soulEssence ?? 0) > 0 && (
              <span className="font-playbill text-sm normal-case tracking-normal tabular-nums" title="Soul essence">
                {metaProgression?.soulEssence}
              </span>
            )}
          </button>
          {legacyHeirlooms.length > 0 && (
            <Placard className="h-8" title="Heirlooms left by earlier characters">
              Legacy items
              <span className="font-playbill text-sm normal-case tracking-normal tabular-nums">{legacyHeirlooms.length}</span>
            </Placard>
          )}
        </div>
      </div>

      {/* posters on the wall */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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

      {showMetaProgression && (
        <MetaProgression onClose={() => setShowMetaProgression(false)} />
      )}

      {showCreation && (
        <PlaybillSheet as="section" className="ps-print-in mt-6 px-4 pb-5 pt-4 sm:px-6" aria-label="New character">
          <div className="mb-4 flex items-center justify-between gap-3">
            <PlaybillCaption>Printing a new character</PlaybillCaption>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-ps-ink text-ps-ink transition-colors hover:bg-ps-ink hover:text-ps-playbill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
              onClick={handleCloseCreation}
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>
          <CharacterCreation onComplete={handleCloseCreation} />
        </PlaybillSheet>
      )}
    </section>
  )
}
