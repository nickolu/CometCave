'use client'
import { BlindRewardsView } from './components/game-views/blind-rewards'
import { BlindSelectionView } from './components/game-views/blind-selection'
import { GameOverView } from './components/game-views/game-over'
import { GamePlayView } from './components/game-views/gameplay'
import JokersView from './components/game-views/jokers'
import { MainMenuView } from './components/game-views/main-menu'
import { PackOpenView } from './components/game-views/pack-open'
import { ShopView } from './components/game-views/shop'
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
    case 'blindRewards':
      return <BlindRewardsView />
    case 'jokers':
      return <JokersView />
    default:
      return <div>Error: Unknown game phase {game.gamePhase}</div>
  }
}
