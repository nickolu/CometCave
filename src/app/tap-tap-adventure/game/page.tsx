'use client'

import CharacterList from '@/app/tap-tap-adventure/components/CharacterList'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { Foyer } from '@/app/tap-tap-adventure/stage/Foyer'
import GameStage from '@/app/tap-tap-adventure/stage/GameStage'
import { AiGate } from '@/components/ai-gate'

function GamePage() {
  const selectedCharacterId = useGameStore(s => s.gameState?.selectedCharacterId)
  if (selectedCharacterId) return <GameStage />
  return (
    <Foyer>
      <CharacterList />
    </Foyer>
  )
}

export default function TapTapAdventureGamePage() {
  return (
    <AiGate game="Tap Tap Adventure" redirectTo="/tap-tap-adventure/game">
      <GamePage />
    </AiGate>
  )
}
