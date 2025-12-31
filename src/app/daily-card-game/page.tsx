'use client'
import { BlindRewardsView } from './components/game-views/blind-rewards'
import { BlindSelectionView } from './components/game-views/blind-selection'
import { BossBlindsView } from './components/game-views/boss-blinds'
import { CelestialsView } from './components/game-views/celestials'
import { GameOverView } from './components/game-views/game-over'
import { GamePlayView } from './components/game-views/gameplay'
import { JokersView } from './components/game-views/jokers'
import { MainMenuView } from './components/game-views/main-menu'
import { PackOpenView } from './components/game-views/pack-open'
import { ShopView } from './components/game-views/shop'
import { SpectralCardsView } from './components/game-views/spectral-cards'
import { TagsView } from './components/game-views/tags'
import { TarotCardsView } from './components/game-views/tarot-cards'
import { VouchersView } from './components/game-views/vouchers'
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
    case 'vouchers':
      return <VouchersView />
    case 'tarotCards':
      return <TarotCardsView />
    case 'celestialCards':
      return <CelestialsView />
    case 'bossBlinds':
      return <BossBlindsView />
    case 'spectralCards':
      return <SpectralCardsView />
    case 'tags':
      return <TagsView />
    default:
      return <div>Error: Unknown game phase {game.gamePhase}</div>
  }
}
