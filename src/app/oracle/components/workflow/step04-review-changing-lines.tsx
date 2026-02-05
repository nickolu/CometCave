import { CircularProgress } from '@mui/material'
import { AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'

import { Hexagram } from '@/app/oracle/components/static-hexagram'
import { TransitionWrapper } from '@/app/oracle/components/ui/transition-wrapper'
import { type DivinationResult } from '@/app/oracle/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Typography } from '@/components/ui/typography'

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
            {divinationResult.hexagram1.name} {divinationResult.hexagram1.description} (
            {divinationResult.hexagram1.number})
          </Typography>
          <Typography className="px-4 flex justify-center col-span-1">becomes</Typography>
          <Typography variant="h5" className="col-span-4 text-center">
            {divinationResult.hexagram2.name} {divinationResult.hexagram2.description} (
            {divinationResult.hexagram2.number})
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

const Present = ({ divinationResult }: { divinationResult: DivinationResult | null }) => {
  return <div>Present goes here</div>
}

const ChangingLines = ({ divinationResult }: { divinationResult: DivinationResult | null }) => {
  return <div>Changing lines goes here</div>
}

const Future = ({ divinationResult }: { divinationResult: DivinationResult | null }) => {
  return <div>Future goes here</div>
}

const DivinationResult = ({ divinationResult }: { divinationResult: DivinationResult | null }) => {
  return (
    <AnimatePresence mode="wait">
      <div className="w-full">
        <Typography variant="h2">Here&apos;s Your Reading From the I-Ching</Typography>
        <div className="w-full space-y-8 max-w-2xl mx-auto">
          <Tabs defaultValue="overview">
            <TabsList className="grid w-full grid-cols-4 mb-16 bg-transparent space-x-4">
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
  return <DivinationResult divinationResult={divinationResult} />
}
