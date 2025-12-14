'use client'
import { GamePlayView } from './game-views/gameplay'
import { BlindSelectionView } from './game-views/blind-selection'
import { PackOpenView } from './game-views/pack-open'
import { ShopView } from './game-views/shop'
import { useGameState } from './useGameState'
import { MainMenuView } from './game-views/main-menu'
import { useGameEvents } from './domain/events/use-game-events'

export default function DailyCardGamePage() {
  const { game } = useGameState()
  useGameEvents()

  switch (game.gamePhase) {
    case 'mainMenu':
      return <MainMenuView />
    case 'shop':
      return <ShopView />
    case 'blindSelection':
      return <BlindSelectionView />
    case 'gameplay':
      return <GamePlayView />
    case 'packOpening':
      return <PackOpenView />
    default:
      return <div>Error: Unknown game phase {game.gamePhase}</div>
  }
}
