'use client'

import { AnimatePresence } from 'framer-motion'

import { TransitionWrapper } from '@/app/oracle/components/ui/transition-wrapper'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Typography } from '@/components/ui/typography'

export const Step02SelectGenerationMethod = ({
  divinationMethod,
  setDivinationMethod,
  onNext,
}: {
  divinationMethod: 'generate' | 'build' | null
  setDivinationMethod: (divinationMethod: 'generate' | 'build' | null) => void
  onNext: () => void
}) => {
  const handleSelectGenerationMethod = (method: 'generate' | 'build') => {
    setDivinationMethod(method)
    onNext()
  }
  return (
    <div>
      <AnimatePresence mode="wait">
        {!divinationMethod && (
          <TransitionWrapper>
            <div className="space-y-8">
              <div>
                <Typography variant="h2">Select Your Divination Method</Typography>
                <Typography>Choose how you want to generate your hexagram.</Typography>
              </div>
              <div className="flex gap-2">
                <Card
                  className="cursor-pointer hover:bg-accent hover:shadow-md hover:translate-y-[1px]"
                  onClick={() => handleSelectGenerationMethod('generate')}
                >
                  <CardHeader>
                    <CardTitle>Generate with Divination</CardTitle>
                  </CardHeader>
                  <CardContent>[IMG Goes Here]</CardContent>
                </Card>
                <Card
                  className="cursor-pointer hover:bg-accent hover:shadow-md hover:translate-y-[1px]"
                  onClick={() => handleSelectGenerationMethod('build')}
                >
                  <CardHeader>
                    <CardTitle>Enter Hexagram Manually</CardTitle>
                  </CardHeader>
                  <CardContent>[IMG Goes Here]</CardContent>
                </Card>
              </div>
            </div>
          </TransitionWrapper>
        )}
      </AnimatePresence>
    </div>
  )
}
