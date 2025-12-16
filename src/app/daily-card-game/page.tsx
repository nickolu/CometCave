'use client'
import { BlindSelectionView } from './game-views/blind-selection'
import { GameOverView } from './game-views/game-over'
import { GamePlayView } from './game-views/gameplay'
import { MainMenuView } from './game-views/main-menu'
import { PackOpenView } from './game-views/pack-open'
import { ShopView } from './game-views/shop'
import { useGameEvents } from './useGameEvents'
import { useGameState } from './useGameState'

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
    case 'gameOver':
      return <GameOverView />
    default:
      return <div>Error: Unknown game phase {game.gamePhase}</div>
  }
}
