import * as React from 'react'

import { cn } from '@/lib/utils'

type AnswerState = 'idle' | 'focused' | 'correct' | 'wrong' | 'disabled'

export interface AnswerOptionProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  letter: 'A' | 'B' | 'C' | 'D'
  label: string
  state?: AnswerState
  selected?: boolean
  onSelect?: () => void
}

const stateStyles: Record<AnswerState, string> = {
  idle: [
    'border-outline-variant',
    'hover:-translate-y-1 hover:shadow-glow-primary',
    'active:translate-y-[var(--press-offset-button-sm)] active:shadow-pressed',
    'motion-reduce:hover:translate-y-0 motion-reduce:active:translate-y-0',
  ].join(' '),
  focused: [
    'border-primary-container -translate-y-1',
    'shadow-glow-primary',
    'active:translate-y-[var(--press-offset-button-sm)] active:shadow-pressed',
    'motion-reduce:translate-y-0 motion-reduce:active:translate-y-0',
  ].join(' '),
  correct: [
    'border-primary-container bg-primary-container/15',
    'pointer-events-none',
  ].join(' '),
  wrong: [
    'border-ds-error bg-ds-error/15',
    'pointer-events-none',
  ].join(' '),
  disabled: [
    'border-outline-variant opacity-60',
    'pointer-events-none',
  ].join(' '),
}

const badgeStyles: Record<AnswerState, string> = {
  idle: 'bg-surface-container-highest text-on-surface-variant',
  focused: 'bg-primary-container/20 text-ds-primary shadow-glow-primary',
  correct: 'bg-primary-container/30 text-ds-primary',
  wrong: 'bg-ds-error/20 text-ds-error',
  disabled: 'bg-surface-container-highest text-on-surface-variant',
}

const AnswerOption = React.forwardRef<HTMLButtonElement, AnswerOptionProps>(
  ({ letter, label, state = 'idle', selected, onSelect, className, onClick, ...props }, ref) => {
    const resolvedState = selected && state === 'idle' ? 'focused' : state
    const showIcon = resolvedState === 'correct' || resolvedState === 'wrong'

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onSelect?.()
      onClick?.(e)
    }

    return (
      <button
        ref={ref}
        type="button"
        onClick={handleClick}
        disabled={resolvedState === 'disabled'}
        className={cn(
          'flex items-center gap-4 w-full min-h-[88px] px-component-px py-4',
          'bg-surface-container-high rounded-ds-sm',
          'border-2 shadow-button-sm',
          'text-left text-on-surface text-body-lg font-body',
          'transition-all duration-150 ease-out',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-container',
          'cursor-pointer',
          stateStyles[resolvedState],
          className
        )}
        {...props}
      >
        <span
          className={cn(
            'flex shrink-0 items-center justify-center',
            'h-12 w-12 rounded-full',
            'font-headline text-lg font-bold',
            'transition-colors duration-150',
            badgeStyles[resolvedState]
          )}
        >
          {showIcon ? (
            <span className="material-symbols-outlined text-[24px]">
              {resolvedState === 'correct' ? 'check' : 'close'}
            </span>
          ) : (
            letter
          )}
        </span>
        <span className="flex-1">{label}</span>
      </button>
    )
  }
)
AnswerOption.displayName = 'AnswerOption'

export { AnswerOption }
