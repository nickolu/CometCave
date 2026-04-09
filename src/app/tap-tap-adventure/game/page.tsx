'use client'
import GameUI from '@/app/tap-tap-adventure/components/GameUI'
import { HudBar } from '@/app/tap-tap-adventure/components/HudBar'
import { PageTemplate } from '@/app/tap-tap-adventure/components/ui/PageTemplate'

export default function TapTapAdventurePage() {
  return (
    <PageTemplate pageId="game">
      <div className="flex-1">
        <HudBar />
      </div>
      <GameUI />
    </PageTemplate>
  )
}
