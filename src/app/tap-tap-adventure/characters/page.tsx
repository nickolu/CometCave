'use client'

import CharacterList from '@/app/tap-tap-adventure/components/CharacterList'
import { Foyer } from '@/app/tap-tap-adventure/stage/Foyer'
import { AiGate } from '@/components/ai-gate'

export default function TapTapAdventureCharactersPage() {
  return (
    <AiGate game="Tap Tap Adventure" redirectTo="/tap-tap-adventure/characters">
      <Foyer>
        <CharacterList />
      </Foyer>
    </AiGate>
  )
}
