import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export const GameCard = ({
  children,
  className,
  isSelected,
  onClick,
}: {
  children: React.ReactNode
  className?: string
  isSelected?: boolean
  onClick?: () => void
}) => {
  return (
    <Card
      className={cn(
        isSelected ? 'ring-2 ring-space-purple transform -translate-y-2' : '',
        'h-36 w-24 transform transition-all duration-300 cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {children}
    </Card>
  )
}
