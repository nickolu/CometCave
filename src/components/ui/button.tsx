import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-space-purple text-cream-white hover:bg-space-purple/90',
        destructive: 'bg-red-600 text-cream-white hover:bg-red-700',
        outline:
          'border border-space-purple/30 bg-transparent hover:bg-space-purple/20 hover:text-cream-white text-cream-white',
        secondary: 'bg-space-dark text-cream-white hover:bg-space-dark/80',
        ghost: 'hover:bg-space-dark/50 hover:text-cream-white text-cream-white',
        link: 'text-space-purple underline-offset-4 hover:underline',
        space: 'bg-space-blue text-cream-white hover:bg-space-blue/90',
        grey: 'bg-space-grey text-cream-white hover:bg-space-grey/80',
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
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
