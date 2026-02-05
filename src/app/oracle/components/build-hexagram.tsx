import { CircularProgress } from '@mui/material'
import { useState } from 'react'

import { possibleHexagrams } from '@/app/oracle/possible-hexagrams'
import { ChangingLines, DivinationQuestion, DivinationResult } from '@/app/oracle/types'
import { getInterpretation } from '@/app/oracle/utils/interpret-reading'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'

import { InteractiveHexagram } from './interative-hexagram'

function getDivinationResultFromChangingLines(changingLines: ChangingLines): DivinationResult {
  const hexagram1 = [
    changingLines[0]?.type === 'solid' ? true : false,
    changingLines[1]?.type === 'solid' ? true : false,
    changingLines[2]?.type === 'solid' ? true : false,
    changingLines[3]?.type === 'solid' ? true : false,
    changingLines[4]?.type === 'solid' ? true : false,
    changingLines[5]?.type === 'solid' ? true : false,
  ]
  const hexagram2 = [
    changingLines[0]?.hasChanges ? !hexagram1[0] : hexagram1[0],
    changingLines[1]?.hasChanges ? !hexagram1[1] : hexagram1[1],
    changingLines[2]?.hasChanges ? !hexagram1[2] : hexagram1[2],
    changingLines[3]?.hasChanges ? !hexagram1[3] : hexagram1[3],
    changingLines[4]?.hasChanges ? !hexagram1[4] : hexagram1[4],
    changingLines[5]?.hasChanges ? !hexagram1[5] : hexagram1[5],
  ]

  const hexagram1Definition = possibleHexagrams.find(hexagram =>
    hexagram.hexagram.every((line, index) => line === hexagram1[index])
  )
  const hexagram2Definition = possibleHexagrams.find(hexagram =>
    hexagram.hexagram.every((line, index) => line === hexagram2[index])
  )

  return {
    changingLines: changingLines,
    hexagram1: hexagram1Definition ?? possibleHexagrams[0],
    hexagram2: hexagram2Definition ?? possibleHexagrams[0],
  }
}

export const EnterDivinationManually = ({
  divinationQuestion,
  onDivinationEntryComplete,
}: {
  divinationQuestion: DivinationQuestion
  onDivinationEntryComplete: (divinationResult: DivinationResult) => void
}) => {
  const [changingLines, setChangingLines] = useState<ChangingLines>([
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
  ])
  const [isLoadingInterpretation, setIsLoadingInterpretation] = useState(false)

  const handleDivinationEntryComplete = async () => {
    setIsLoadingInterpretation(true)
    const divinationResult = getDivinationResultFromChangingLines(changingLines)

    // Get AI interpretation
    const interpretation = await getInterpretation(divinationQuestion, divinationResult)
    divinationResult.interpretation = interpretation

    setIsLoadingInterpretation(false)
    onDivinationEntryComplete(divinationResult)
  }

  if (isLoadingInterpretation) {
    return (
      <div className="w-full space-y-8 items-center justify-center flex flex-col">
        <Typography variant="h2">Generating Your Reading...</Typography>
        <CircularProgress size={40} />
      </div>
    )
  }

  return (
    <div className="flex flex-col space-y-8 items-center justify-center">
      <div className="space-y-4 max-w-xl mx-auto">
        <Typography variant="h2">Build Hexagram Manually</Typography>
        <Typography variant="h3">&quot;{divinationQuestion.question}&quot;</Typography>
        <Typography>
          Build the hexagram from the result of your own divination method <br />
          (yarrow stalk, coins, etc.).
        </Typography>
      </div>
      <InteractiveHexagram changingLines={changingLines} setChangingLines={setChangingLines} />
      <Button
        type="button"
        disabled={changingLines.some(line => line === undefined)}
        onClick={() => handleDivinationEntryComplete()}
      >
        Submit
      </Button>
    </div>
  )
}
