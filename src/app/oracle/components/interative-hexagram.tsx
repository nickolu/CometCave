import { ChangingLine, ChangingLines } from '@/app/oracle/types'
import { cn } from '@/lib/utils'

import { TransitionWrapper } from './ui/transition-wrapper'

const lineBg = 'bg-neutral-200'
const lineBorder = 'border-neutral-200'

export const InteractiveSolidLine = () => {
  return (
    <div
      className={`w-44 h-4 ${lineBg} opacity-[0.4] hover:opacity-60 transition-all duration-200 cursor-pointer`}
    />
  )
}

export const InteractiveEmptyLine = () => {
  return (
    <div
      className={`w-44 h-4 border b-2 ${lineBorder} opacity-[0.4] hover:opacity-60 transition-all duration-200 cursor-pointer`}
    />
  )
}

export const InteractiveBrokenLine = () => {
  return (
    <div
      className={`flex items-center justify-center space-x-4 transition-all duration-200 opacity-[0.4] hover:opacity-60 cursor-pointer`}
    >
      <div className={`w-20 h-4 ${lineBg}`} />
      <div className={`w-20 h-4 ${lineBg} transition-all duration-200`} />
    </div>
  )
}

export const InteractiveChangeMarker = ({ hasChanges }: { hasChanges: boolean }) => {
  return (
    <div
      className={cn(
        `w-4 h-4 rounded-full transition-all duration-200 cursor-pointer`,
        hasChanges
          ? `${lineBg} opacity-[0.4]`
          : `bg-transparent border b-4 ${lineBorder} opacity-[0.4] hover:opacity-60`
      )}
    />
  )
}

export const DynamicLine = ({ type }: { type: 'solid' | 'broken' | undefined }) => {
  return (
    <>
      {type === 'solid' && (
        <TransitionWrapper>
          <InteractiveSolidLine />
        </TransitionWrapper>
      )}
      {type === 'broken' && (
        <TransitionWrapper>
          <InteractiveBrokenLine />
        </TransitionWrapper>
      )}
      {type === undefined && (
        <TransitionWrapper>
          <InteractiveEmptyLine />
        </TransitionWrapper>
      )}
    </>
  )
}

export const LineControl = ({
  lineData,
  toggleLine,
  toggleHasChanges,
}: {
  lineData: ChangingLine | undefined
  toggleHasChanges: () => void
  toggleLine: () => void
}) => {
  return (
    <div className="flex gap-2">
      <div onClick={() => toggleLine()}>
        <DynamicLine type={lineData?.type} />
      </div>
      <div onClick={() => toggleHasChanges()}>
        <InteractiveChangeMarker hasChanges={Boolean(lineData?.hasChanges)} />
      </div>
    </div>
  )
}

export const InteractiveHexagram = ({
  changingLines,
  setChangingLines,
}: {
  changingLines: ChangingLines
  setChangingLines: (hexagramData: ChangingLines) => void
}) => {
  const line1 = changingLines[0]
  const line2 = changingLines[1]
  const line3 = changingLines[2]
  const line4 = changingLines[3]
  const line5 = changingLines[4]
  const line6 = changingLines[5]

  const toggleLine = (lineIndex: number) => {
    const updatedChangingLines: ChangingLines = [...changingLines]
    if (updatedChangingLines[lineIndex] === undefined) {
      updatedChangingLines[lineIndex] = { type: 'solid', hasChanges: false }
    } else if (updatedChangingLines[lineIndex].type === 'solid') {
      updatedChangingLines[lineIndex].type = 'broken'
    } else {
      updatedChangingLines[lineIndex].type = 'solid'
    }
    setChangingLines(updatedChangingLines)
  }

  const toggleHasChanges = (lineIndex: number) => {
    const updatedChangingLines: ChangingLines = [...changingLines]
    if (updatedChangingLines[lineIndex] === undefined) {
      return
    }

    updatedChangingLines[lineIndex].hasChanges = !updatedChangingLines[lineIndex].hasChanges
    setChangingLines(updatedChangingLines)
  }

  return (
    <div className="flex flex-col gap-4 items-center">
      <LineControl
        lineData={line1}
        toggleLine={() => toggleLine(0)}
        toggleHasChanges={() => toggleHasChanges(0)}
      />
      <LineControl
        lineData={line2}
        toggleLine={() => toggleLine(1)}
        toggleHasChanges={() => toggleHasChanges(1)}
      />
      <LineControl
        lineData={line3}
        toggleLine={() => toggleLine(2)}
        toggleHasChanges={() => toggleHasChanges(2)}
      />
      <LineControl
        lineData={line4}
        toggleLine={() => toggleLine(3)}
        toggleHasChanges={() => toggleHasChanges(3)}
      />
      <LineControl
        lineData={line5}
        toggleLine={() => toggleLine(4)}
        toggleHasChanges={() => toggleHasChanges(4)}
      />
      <LineControl
        lineData={line6}
        toggleLine={() => toggleLine(5)}
        toggleHasChanges={() => toggleHasChanges(5)}
      />
    </div>
  )
}
