'use client'
import CharacterList from '@/app/fantasy-tycoon/components/CharacterList'
import { HudBar } from '@/app/fantasy-tycoon/components/HudBar'
import { PageTemplate } from '@/app/fantasy-tycoon/components/ui/PageTemplate'

export default function FantasyTycoonPageCharacters() {
  return (
    <PageTemplate pageId="characters">
      <div className="flex-1">
        <HudBar />
      </div>
      <CharacterList />
    </PageTemplate>
  )
}
