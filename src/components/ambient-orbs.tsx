import * as React from 'react'

import { cn } from '@/lib/utils'

type OrbColor = 'primary' | 'secondary' | 'tertiary'

const orbColorMap: Record<OrbColor, string> = {
  primary: 'bg-ds-primary',
  secondary: 'bg-ds-secondary',
  tertiary: 'bg-ds-tertiary',
}

const intensityMap = {
  low: 'opacity-10',
  medium: 'opacity-20',
  high: 'opacity-30',
} as const

// Deterministic positions so layouts stay stable across renders
const orbPositions = [
  { top: '10%', left: '75%', size: 'h-96 w-96' },
  { top: '60%', left: '10%', size: 'h-80 w-80' },
  { top: '30%', left: '50%', size: 'h-64 w-64' },
] as const

export interface AmbientOrbsProps extends React.HTMLAttributes<HTMLDivElement> {
  palette?: OrbColor[]
  intensity?: 'low' | 'medium' | 'high'
}

const AmbientOrbs = React.forwardRef<HTMLDivElement, AmbientOrbsProps>(
  ({ palette = ['primary', 'secondary'], intensity = 'medium', className, ...props }, ref) => (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn('pointer-events-none fixed inset-0 z-0 overflow-hidden', className)}
      {...props}
    >
      {palette.map((color, i) => {
        const pos = orbPositions[i % orbPositions.length]
        return (
          <div
            key={`${color}-${i}`}
            className={cn(
              'absolute rounded-full blur-3xl',
              orbColorMap[color],
              intensityMap[intensity],
              pos.size
            )}
            style={{ top: pos.top, left: pos.left }}
          />
        )
      })}
    </div>
  )
)
AmbientOrbs.displayName = 'AmbientOrbs'

export { AmbientOrbs }
