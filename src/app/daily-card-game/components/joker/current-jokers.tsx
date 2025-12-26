import { Joker } from '@/app/daily-card-game/components/gameplay/joker'
import { useGameState } from '@/app/daily-card-game/useGameState'

export const CurrentJokers = () => {
  const { game } = useGameState()
  return (
    <div className="flex flex-wrap gap-2">
      {game.jokers.map(joker => (
        <Joker key={joker.id} joker={joker} />
      ))}
    </div>
  )
}
