'use client'
import { AnimatePresence, motion } from 'framer-motion'
import { CosmicShell } from './components/cosmic/shell'
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

const phaseVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

const phaseTransition = {
  duration: 0.15,
  ease: [0.2, 0.9, 0.3, 1] as const,
}

function PhaseView() {
  const { game } = useGameState()

  let view: React.ReactNode
  switch (game.gamePhase) {
    case 'mainMenu':
      view = <MainMenuView />; break
    case 'shop':
      view = <ShopView />; break
    case 'blindSelection':
      view = <BlindSelectionView />; break
    case 'gameplay':
      view = <GamePlayView />; break
    case 'packOpening':
      view = <PackOpenView />; break
    case 'gameOver':
      view = <GameOverView />; break
    case 'blindRewards':
      view = <BlindRewardsView />; break
    case 'jokers':
      view = <JokersView />; break
    case 'vouchers':
      view = <VouchersView />; break
    case 'tarotCards':
      view = <TarotCardsView />; break
    case 'celestialCards':
      view = <CelestialsView />; break
    case 'bossBlinds':
      view = <BossBlindsView />; break
    case 'spectralCards':
      view = <SpectralCardsView />; break
    case 'tags':
      view = <TagsView />; break
    default:
      view = <div>Error: Unknown game phase {game.gamePhase}</div>
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={game.gamePhase}
        variants={phaseVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={phaseTransition}
        style={{ width: '100%', height: '100%' }}
      >
        {view}
      </motion.div>
    </AnimatePresence>
  )
}

export default function CometCardsPage() {
  useGameEvents()
  return (
    <CosmicShell>
      <PhaseView />
    </CosmicShell>
  )
}
