'use client'
import { useState } from 'react'

import { AiGate } from '@/components/ai-gate'

import CharacterList from './components/CharacterList'
import MetaProgression from './components/MetaProgression'
import RunSummary from './components/RunSummary'
import { useGameStore } from './hooks/useGameStore'
import { Foyer } from './stage/Foyer'
import GameStage from './stage/GameStage'

function TapTapAdventurePage() {
  const { gameState, clearRunSummary } = useGameStore()
  const [showMetaFromSummary, setShowMetaFromSummary] = useState(false)
  const [showCreationFromSummary, setShowCreationFromSummary] = useState(false)

  // The run summary takes the stage over everything else.
  const runSummary = gameState?.runSummary ?? null
  if (runSummary) {
    return (
      <Foyer>
        <RunSummary
          data={runSummary}
          onViewUpgrades={() => setShowMetaFromSummary(true)}
          onNewCharacter={() => {
            clearRunSummary()
            setShowCreationFromSummary(true)
          }}
          onBackToCharacters={() => clearRunSummary()}
        />
        {showMetaFromSummary && <MetaProgression onClose={() => setShowMetaFromSummary(false)} />}
      </Foyer>
    )
  }

  if (gameState?.selectedCharacterId) return <GameStage />

  return (
    <Foyer>
      <CharacterList defaultShowCreation={showCreationFromSummary} onCreationShown={() => setShowCreationFromSummary(false)} />
    </Foyer>
  )
}

export default function TapTapAdventurePageGated() {
  return (
    <AiGate game="Tap Tap Adventure" redirectTo="/tap-tap-adventure">
      <TapTapAdventurePage />
    </AiGate>
  )
}
