'use client'
import { useState } from 'react'
import CharacterList from './components/CharacterList'
import GameUI from './components/GameUI'
import { HudBar } from './components/HudBar'
import MetaProgression from './components/MetaProgression'
import { PlayerStatusView } from './components/PlayerStatusView'
import RunSummary from './components/RunSummary'
import { PageTemplate } from './components/ui/PageTemplate'
import { useGameStore } from './hooks/useGameStore'

type initialView = 'game' | 'characters'

export default function TapTapAdventurePage() {
  const { gameState, clearRunSummary } = useGameStore()
  const [showMetaFromSummary, setShowMetaFromSummary] = useState(false)
  const [showCreationFromSummary, setShowCreationFromSummary] = useState(false)
  const [showStatus, setShowStatus] = useState(false)

  let initialView: initialView = 'characters'

  if (gameState?.selectedCharacterId) {
    initialView = 'game'
  }

  // Run summary takes priority over everything
  const runSummary = gameState?.runSummary ?? null

  return (
    <PageTemplate pageId={initialView}>
      <div className="flex-1">
        <HudBar onOpenStatus={() => setShowStatus(true)} />
      </div>
      {showStatus && <PlayerStatusView onClose={() => setShowStatus(false)} />}
      {runSummary ? (
        <>
          <RunSummary
            data={runSummary}
            onViewUpgrades={() => {
              setShowMetaFromSummary(true)
            }}
            onNewCharacter={() => {
              clearRunSummary()
              setShowCreationFromSummary(true)
            }}
            onBackToCharacters={() => {
              clearRunSummary()
            }}
          />
          {showMetaFromSummary && (
            <MetaProgression onClose={() => setShowMetaFromSummary(false)} />
          )}
        </>
      ) : (
        <>
          {initialView === 'game' && <GameUI onOpenStatus={() => setShowStatus(true)} />}
          {initialView === 'characters' && (
            <CharacterList defaultShowCreation={showCreationFromSummary} onCreationShown={() => setShowCreationFromSummary(false)} />
          )}
        </>
      )}
    </PageTemplate>
  )
}
