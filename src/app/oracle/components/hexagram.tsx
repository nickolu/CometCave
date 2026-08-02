```tsx
import { ChangingLine, ChangingLines } from '@/app/oracle/types'
import { cn } from '@/lib/utils'

import { TransitionWrapper } from './ui/transition-wrapper'

const lineBg = 'bg-neutral-200'
const lineBorder = 'border-neutral-200'

export const SolidLine = ({ isStatic = false }: { isStatic?: boolean }) => {
  return (
    <div
      className={`w-44 h-4 ${lineBg} opacity-[0.4] hover:opacity-60 transition-all duration-200 ${isStatic ? '' : 'cursor-pointer'}`}
    />
  )
}

export const EmptyLine = ({ isStatic = false }: { isStatic?: boolean }) => {
  return (
    <div
      className={`w-44 h-4 border-2 ${lineBorder} opacity-[0.4] hover:opacity-60 transition-all duration-200 ${isStatic ? '' : 'cursor-pointer'}`}
    />
  )
}

export const BrokenLine = ({ isStatic = false }: { isStatic?: boolean }) => {
  return (
    <div
      className={`flex items-center justify-center space-x-4 transition-all duration-200 opacity-[0.4] hover:opacity-60 ${isStatic ? '' : 'cursor-pointer'}`}
    >
      <div className={`w-20 h-4 ${lineBg}`} />
      <div className={`w-20 h-4 ${lineBg} transition-all duration-200`} />
    </div>
  )
}

export const ChangeMarker = ({
  hasChanges,
  isStatic = false,
}: {
  hasChanges: boolean
  isStatic?: boolean
}) => {
  return (
    <div
      className={cn(
        `w-4 h-4 rounded-full transition-all duration-200 ${isStatic ? '' : 'cursor-pointer'}`,
        hasChanges
          ? `${lineBg} opacity-[0.4]`
          : `bg-transparent border-4 ${lineBorder} opacity-[0.4] hover:opacity-60`
      )}
    />
  )
}

export const Line = ({
  type,
  isStatic = false,
}: {
  type: 'solid' | 'broken' | undefined
  isStatic?: boolean
}) => {
  return (
    <>
      {type === 'solid' && (
        <TransitionWrapper>
          <SolidLine isStatic={isStatic} />
        </TransitionWrapper>
      )}
      {type === 'broken' && (
        <TransitionWrapper>
          <BrokenLine isStatic={isStatic} />
        </TransitionWrapper>
      )}
      {type === undefined && (
        <TransitionWrapper>
          <EmptyLine isStatic={isStatic} />
        </TransitionWrapper>
      )}
    </>
  )
}

export const LineControl = ({
  lineData,
  toggleLine,
  toggleHasChanges,
  isStatic,
}: {
  lineData: ChangingLine | undefined
  toggleHasChanges: () => void
  toggleLine: () => void
  isStatic: boolean
}) => {
  return (
    <div className="flex gap-2">
      <div
        onClick={isStatic ? undefined : () => toggleLine()}
        role={isStatic ? undefined : 'button'}
        tabIndex={isStatic ? undefined : 0}
        onKeyDown={isStatic ? undefined : e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleLine() } }}
      >
        <Line type={lineData?.type} isStatic={isStatic} />
      </div>
      <div
        onClick={isStatic ? undefined : () => toggleHasChanges()}
        role={isStatic ? undefined : 'button'}
        tabIndex={isStatic ? undefined : 0}
        onKeyDown={isStatic ? undefined : e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleHasChanges() } }}
      >
        <ChangeMarker hasChanges={lineData?.hasChanges ?? false} isStatic={isStatic} />
      </div>
    </div>
  )
}
```