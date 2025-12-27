import { Joker } from '@/app/daily-card-game/components/gameplay/joker'
import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { initializeJoker } from '@/app/daily-card-game/domain/joker/utils'
import { Button } from '@/components/ui/button'

const JokersView = () => {
  return (
    <div className="flex flex-col items-center mt-10 h-screen w-3/4 mx-auto">
      <h1 className="text-2xl font-bold">Jokers</h1>
      <div className="flex flex-wrap gap-2 mt-4">
        {Object.values(jokers).map(joker => (
          <Joker key={joker.id} joker={initializeJoker(joker)} />
        ))}
      </div>
      <Button
        className="mt-4"
        onClick={() => {
          eventEmitter.emit({ type: 'BACK_TO_MAIN_MENU' })
        }}
      >
        Back to Main Menu
      </Button>
    </div>
  )
}

export default JokersView
