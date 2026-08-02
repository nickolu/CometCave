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
        aria-label={isStatic ? undefined : 'Toggle line type'}
      >
        <Line type={lineData?.type} isStatic={isStatic} />
      </div>
      <div
        onClick={isStatic ? undefined : () => toggleHasChanges()}
        role={isStatic ? undefined : 'button'}
        tabIndex={isStatic ? undefined : 0}
        onKeyDown={isStatic ? undefined : e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleHasChanges() } }}
        aria-label={isStatic ? undefined : 'Toggle changing line'}
      >
        <ChangeMarker hasChanges={Boolean(lineData?.hasChanges)} isStatic={isStatic} />
      </div>
    </div>
  )
}

export const Hexagram = ({
  hexagramData,
  setChangingLines,
}: {
  hexagramData: ChangingLines // these should already be in reverse order (bottom is line 1 and top is line 6)
  setChangingLines?: (hexagramData: ChangingLines) => void
}) => {
  const line1 = hexagramData[0]
  const line2 = hexagramData[1]
  const line3 = hexagramData[2]
  const line4 = hexagramData[3]
  const line5 = hexagramData[4]
  const line6 = hexagramData[5]

  const toggleLine = (lineIndex: number) => {
    const updatedChangingLines: ChangingLines = [...hexagramData]
    if (updatedChangingLines[lineIndex] === undefined) {
      updatedChangingLines[lineIndex] = { type: 'solid', hasChanges: false }
    } else if (updatedChangingLines[lineIndex].type === 'solid') {
      updatedChangingLines[lineIndex].type = 'broken'
    } else {
      updatedChangingLines[lineIndex].type = 'solid'
    }
    setChangingLines?.(updatedChangingLines)
  }

  const toggleHasChanges = (lineIndex: number) => {
    const updatedChangingLines: ChangingLines = [...hexagramData]
    if (updatedChangingLines[lineIndex] === undefined) {
      return
    }

    updatedChangingLines[lineIndex].hasChanges = !updatedChangingLines[lineIndex].hasChanges
    setChangingLines?.(updatedChangingLines)
  }

  return (
    <div className="flex flex-col gap-4 items-center">
      <LineControl
        lineData={line1}
        isStatic={Boolean(setChangingLines === undefined)}
        toggleLine={() => toggleLine(0)}
        toggleHasChanges={() => toggleHasChanges(0)}
      />
      <LineControl
        lineData={line2}
        isStatic={Boolean(setChangingLines === undefined)}
        toggleLine={() => toggleLine(1)}
        toggleHasChanges={() => toggleHasChanges(1)}
      />
      <LineControl
        lineData={line3}
        isStatic={Boolean(setChangingLines === undefined)}
        toggleLine={() => toggleLine(2)}
        toggleHasChanges={() => toggleHasChanges(2)}
      />
      <LineControl
        lineData={line4}
        isStatic={Boolean(setChangingLines === undefined)}
        toggleLine={() => toggleLine(3)}
        toggleHasChanges={() => toggleHasChanges(3)}
      />
      <LineControl
        lineData={line5}
        isStatic={Boolean(setChangingLines === undefined)}
        toggleLine={() => toggleLine(4)}
        toggleHasChanges={() => toggleHasChanges(4)}
      />
      <LineControl
        lineData={line6}
        isStatic={Boolean(setChangingLines === undefined)}
        toggleLine={() => toggleLine(5)}
        toggleHasChanges={() => toggleHasChanges(5)}
      />
    </div>
  )
}
