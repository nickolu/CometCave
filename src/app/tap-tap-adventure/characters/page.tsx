'use client'
import CharacterList from '@/app/tap-tap-adventure/components/CharacterList'
import { HudBar } from '@/app/tap-tap-adventure/components/HudBar'
import { PageTemplate } from '@/app/tap-tap-adventure/components/ui/PageTemplate'

export default function TapTapAdventurePageCharacters() {
  return (
    <PageTemplate pageId="characters">
      <div className="flex-1">
        <HudBar />
      </div>
      <CharacterList />
    </PageTemplate>
  )
}
