import { CircularProgress } from '@mui/material'
import { AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'

import { Hexagram } from '@/app/oracle/components/static-hexagram'
import { TransitionWrapper } from '@/app/oracle/components/ui/transition-wrapper'
import { changingLineDescriptions, hexagramDescriptions } from '@/app/oracle/library'
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
  return (
    <div className="space-y-4">
      <Typography variant="h2">Present: {getHexagramTitle(divinationResult.hexagram1)}</Typography>
      <Typography variant="body1" className="whitespace-pre-line">
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
    .filter((index) => index !== -1)

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
        These lines are in motion, representing the dynamic aspects of your situation.
      </Typography>
      <div className="space-y-6">
        {changingLineIndices.map((lineIndex) => (
          <div key={lineIndex} className="space-y-2">
            <Typography variant="h5" className="text-space-purple">
              Line {lineIndex + 1} (
              {changingLines[lineIndex]?.type === 'solid' ? 'Yang → Yin' : 'Yin → Yang'})
            </Typography>
            <Typography variant="body1" className="whitespace-pre-line">
              {lineDescriptions[lineIndex]}
            </Typography>
          </div>
        ))}
      </div>
    </div>
  )
}

const Future = ({ divinationResult }: { divinationResult: DivinationResult }) => {
  return (
    <div className="space-y-4">
      <Typography variant="h2">Future: {getHexagramTitle(divinationResult.hexagram2)}</Typography>
      <Typography variant="body1" className="whitespace-pre-line">
        {hexagramDescriptions[divinationResult.hexagram2.number]}
      </Typography>
    </div>
  )
}

const Interpretation = ({ divinationResult }: { divinationResult: DivinationResult }) => {
  return <div>Interpretation goes here</div>
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
  const [hasLoaded, setHasLoaded] = useState(false)

  useEffect(() => {
    if (divinationResult) {
      setTimeout(
        () => {
          setHasLoaded(true)
        },
        Math.random() * 2000 + 1000
      )
    }
  }, [divinationResult])

  if (!hasLoaded) return <DivinationResultLoader />
  if (!divinationResult) return null
  return <DivinationResult divinationResult={divinationResult} />
}
