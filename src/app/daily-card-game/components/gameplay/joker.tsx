import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { JokerDefinition, JokerState } from '@/app/daily-card-game/domain/joker/types'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const FaceUpJoker = ({ joker }: { joker: JokerDefinition }) => {
  return (
    <div className={'px-1 h-full '}>
      <div>
        <h3 className="text-sm font-bold">{joker?.name}</h3>
        <p className="text-xs text-muted-foreground">{joker?.description}</p>
      </div>
    </div>
  )
}

// const FaceDownJoker = () => {
//   return (
//     <div className="flex flex-col px-1 h-full bg-space-grey">
//       <div data-name="top-row" className="flex justify-between">
//         <div>?</div>
//       </div>
//       <div data-name="image-row" className="flex justify-center grow items-center">
//         <div>?</div>
//       </div>
//     </div>
//   )
// }

export const Joker = ({
  joker,
  isSelected,
  onClick,
}: {
  joker: JokerState
  isSelected?: boolean
  onClick?: (isSelected: boolean, id: string) => void
}) => {
  const jokerDefinition = jokers[joker.jokerId]
  return (
    <Card
      className={cn(
        isSelected ? 'ring-2 ring-space-purple -mt-2' : '',
        'h-36 w-24 transform transition-all duration-300 cursor-pointer'
      )}
      onClick={() => {
        onClick?.(isSelected ?? false, joker.id)
      }}
    >
      <FaceUpJoker joker={jokerDefinition} />
    </Card>
  )
}
