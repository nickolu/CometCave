import { CircularProgress } from '@mui/material'
import { AnimatePresence } from 'framer-motion'

import { Hexagram } from '@/app/oracle/components/static-hexagram'
import { TransitionWrapper } from '@/app/oracle/components/ui/transition-wrapper'
import { changingLineDescriptions, hexagramDescriptions } from '@/app/oracle/library'
import { getHexagramTrigrams } from '@/app/oracle/trigrams'
import { type DivinationResult, HexagramDefinition } from '@/app/oracle/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Typography } from '@/components/ui/typography'

function getHexagramTitle(hexagram: HexagramDefinition): string {
  return `${hexagram.name} ${hexagram.description} (${hexagram.number})`
}

const DivinationResultLoader = () => {
  return (
    <div className="w-full space-y-8 items-center justify-center flex flex-col">
      <Typography variant="h2">Loading Your Reading...</Typography>
      <CircularProgress size={40} />
    </div>
  )
}

const Overview = ({ divinationResult }: { divinationResult: DivinationResult | null }) => {
  if (!divinationResult) return null
  const hexagram1Lines = divinationResult.hexagram1.hexagram
  const changingLines = divinationResult.changingLines
  const hexagram2Lines = divinationResult.hexagram2.hexagram

  return (
    <div className="w-full space-y-8 max-w-2xl mx-auto">
      <div>
        <div className="flex mb-4 flex-col items-center gap-2 md:grid md:grid-cols-9 ">
          <Typography variant="h5" className="col-span-4 text-center">
            {getHexagramTitle(divinationResult.hexagram1)}
          </Typography>
          <Typography className="px-4 flex justify-center col-span-1">becomes</Typography>
          <Typography variant="h5" className="col-span-4 text-center">
            {getHexagramTitle(divinationResult.hexagram2)}
          </Typography>
        </div>
        <div className="flex gap-4 justify-center scale-75 sm:scale-100 grid grid-cols-9">
          <div className="col-span-4 flex items-center justify-center">
            <Hexagram hexagram={hexagram1Lines} />
          </div>
          <div className="flex flex-col gap-4 col-span-1">
            <div className="h-4 flex items-center justify-center text-2xl">
              {changingLines[0]?.hasChanges ? '→' : ''}
            </div>
            <div className="h-4 flex items-center justify-center text-2xl">
              {changingLines[1]?.hasChanges ? '→' : ''}
            </div>
            <div className="h-4 flex items-center justify-center text-2xl">
              {changingLines[2]?.hasChanges ? '→' : ''}
            </div>
            <div className="h-4 flex items-center justify-center text-2xl">
              {changingLines[3]?.hasChanges ? '→' : ''}
            </div>
            <div className="h-4 flex items-center justify-center text-2xl">
              {changingLines[4]?.hasChanges ? '→' : ''}
            </div>
            <div className="h-4 flex items-center justify-center text-2xl">
              {changingLines[5]?.hasChanges ? '→' : ''}
            </div>
          </div>
          <div className="col-span-4 flex items-center justify-center">
            <Hexagram hexagram={hexagram2Lines} />
          </div>
        </div>
      </div>
    </div>
  )
}

const Present = ({ divinationResult }: { divinationResult: DivinationResult }) => {
  const { lowerTrigram, upperTrigram } = getHexagramTrigrams(divinationResult.hexagram1.hexagram)

  return (
    <div className="space-y-6">
      <Typography variant="h2">Present: {getHexagramTitle(divinationResult.hexagram1)}</Typography>

      <div className="flex flex-col items-center gap-4">
        <Hexagram hexagram={divinationResult.hexagram1.hexagram} />
        <div className="text-center space-y-1">
          <Typography variant="body2" className="text-muted-foreground">
            Upper Trigram: {upperTrigram.name} ({upperTrigram.chinese}) - {upperTrigram.attribute}
          </Typography>
          <Typography variant="body2" className="text-muted-foreground">
            Lower Trigram: {lowerTrigram.name} ({lowerTrigram.chinese}) - {lowerTrigram.attribute}
          </Typography>
        </div>
      </div>

      <Typography variant="body1" className="whitespace-pre-line text-left">
        {hexagramDescriptions[divinationResult.hexagram1.number]}
      </Typography>
    </div>
  )
}

const ChangingLines = ({ divinationResult }: { divinationResult: DivinationResult }) => {
  const hexagramNumber = divinationResult.hexagram1.number
  const lineDescriptions = changingLineDescriptions[hexagramNumber]
  const changingLines = divinationResult.changingLines

  // Get indices of lines that are changing (0-indexed)
  const changingLineIndices = changingLines
    .map((line, index) => (line?.hasChanges ? index : -1))
    .filter(index => index !== -1)

  if (changingLineIndices.length === 0) {
    return (
      <div className="space-y-4">
        <Typography variant="h2">Changing Lines</Typography>
        <Typography variant="body1">No changing lines in this reading.</Typography>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Typography variant="h2">Changing Lines</Typography>
      <Typography variant="body2" className="text-muted-foreground">
        These lines are in motion, representing the dynamic aspects of your situation. <br />
        (Note that hexagrams are built from bottom to top, so the first line is the bottom line)
      </Typography>
      <div className="space-y-6">
        {changingLineIndices.map(lineIndex => {
          const line = changingLines[lineIndex]
          const isYangToYin = line?.type === 'solid'
          const direction = isYangToYin ? 'Yang → Yin' : 'Yin → Yang'

          // Reverse the mapping: index 0 → Line 6 (top), index 5 → Line 1 (bottom)
          // This displays lines from top to bottom while data is stored bottom to top
          const lineNumber = 6 - lineIndex
          const descriptionIndex = 5 - lineIndex

          return (
            <div key={lineIndex} className="space-y-2">
              <Typography variant="h5" className="text-space-purple">
                Line {lineNumber} ({direction})
              </Typography>
              <Typography variant="body1" className="whitespace-pre-line text-left">
                {lineDescriptions[descriptionIndex]}
              </Typography>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const Future = ({ divinationResult }: { divinationResult: DivinationResult }) => {
  const { lowerTrigram, upperTrigram } = getHexagramTrigrams(divinationResult.hexagram2.hexagram)

  return (
    <div className="space-y-6">
      <Typography variant="h2">Future: {getHexagramTitle(divinationResult.hexagram2)}</Typography>

      <div className="flex flex-col items-center gap-4">
        <Hexagram hexagram={divinationResult.hexagram2.hexagram} />
        <div className="text-center space-y-1">
          <Typography variant="body2" className="text-muted-foreground">
            Upper Trigram: {upperTrigram.name} ({upperTrigram.chinese}) - {upperTrigram.attribute}
          </Typography>
          <Typography variant="body2" className="text-muted-foreground">
            Lower Trigram: {lowerTrigram.name} ({lowerTrigram.chinese}) - {lowerTrigram.attribute}
          </Typography>
        </div>
      </div>

      <Typography variant="body1" className="whitespace-pre-line text-left">
        {hexagramDescriptions[divinationResult.hexagram2.number]}
      </Typography>
    </div>
  )
}

const Interpretation = ({ divinationResult }: { divinationResult: DivinationResult }) => {
  if (!divinationResult.interpretation) {
    return (
      <div className="space-y-4">
        <Typography variant="h2">Interpretation</Typography>
        <Typography variant="body1">No interpretation available.</Typography>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Typography variant="h2">AI Interpretation</Typography>
      <Typography variant="body2" className="text-muted-foreground italic">
        This interpretation was generated by AI based on your question, context, and the I-Ching
        reading. It weaves together the ancient wisdom of the hexagrams with practical guidance for
        your specific situation.
      </Typography>
      <Typography variant="body1" className="whitespace-pre-line text-left leading-relaxed">
        {divinationResult.interpretation}
      </Typography>
    </div>
  )
}

const DivinationResult = ({ divinationResult }: { divinationResult: DivinationResult }) => {
  return (
    <AnimatePresence mode="wait">
      <div className="w-full space-y-8">
        <Typography variant="h2">Here&apos;s Your Reading From the I-Ching</Typography>
        <div className="w-full space-y-8 max-w-2xl mx-auto">
          <Tabs defaultValue="overview">
            <TabsList className="grid w-full grid-cols-5 mb-16 bg-transparent">
              <TabsTrigger
                value="overview"
                className="data-[state=active]:bg-space-purple data-[state=active]:text-cream-white"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="present"
                className="data-[state=active]:bg-space-purple data-[state=active]:text-cream-white"
              >
                Present
              </TabsTrigger>
              <TabsTrigger
                value="changing-lines"
                className="data-[state=active]:bg-space-purple data-[state=active]:text-cream-white"
              >
                Changing Lines
              </TabsTrigger>
              <TabsTrigger
                value="future"
                className="data-[state=active]:bg-space-purple data-[state=active]:text-cream-white"
              >
                Future
              </TabsTrigger>
              <TabsTrigger
                value="interpretation"
                className="data-[state=active]:bg-space-purple data-[state=active]:text-cream-white"
              >
                Interpretation
              </TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <TransitionWrapper>
                <Overview divinationResult={divinationResult} />
              </TransitionWrapper>
            </TabsContent>
            <TabsContent value="present">
              <TransitionWrapper>
                <Present divinationResult={divinationResult} />
              </TransitionWrapper>
            </TabsContent>
            <TabsContent value="changing-lines">
              <TransitionWrapper>
                <ChangingLines divinationResult={divinationResult} />
              </TransitionWrapper>
            </TabsContent>
            <TabsContent value="future">
              <TransitionWrapper>
                <Future divinationResult={divinationResult} />
              </TransitionWrapper>
            </TabsContent>
            <TabsContent value="interpretation">
              <TransitionWrapper>
                <Interpretation divinationResult={divinationResult} />
              </TransitionWrapper>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AnimatePresence>
  )
}

export const Step04ReviewReading = ({
  divinationResult,
}: {
  divinationResult: DivinationResult | null
}) => {
  // Show loading if no result yet, or if result exists but interpretation is still loading
  if (!divinationResult || !divinationResult.interpretation) {
    return <DivinationResultLoader />
  }
  return <DivinationResult divinationResult={divinationResult} />
}
