import { Slot } from '@radix-ui/react-slot'
import { type VariantProps, cva } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-surface-variant text-on-surface hover:bg-surface-variant/80/90',
        destructive: 'bg-red-600 text-on-surface hover:bg-red-700',
        outline:
          'border border-space-purple/30 bg-transparent hover:bg-surface-variant/80/20 hover:text-on-surface text-on-surface',
        secondary: 'bg-surface-container text-on-surface hover:bg-surface-container/80',
        ghost: 'hover:bg-surface-container/50 hover:text-on-surface text-on-surface',
        link: 'text-on-surface-variant underline-offset-4 hover:underline',
        space: 'bg-ds-secondary text-on-surface hover:bg-ds-secondary/90',
        grey: 'bg-surface-container-highest text-on-surface hover:bg-surface-container-highest/80',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
