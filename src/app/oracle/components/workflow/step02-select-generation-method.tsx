'use client'

import { AnimatePresence } from 'framer-motion'

import { TransitionWrapper } from '@/app/oracle/components/ui/transition-wrapper'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Typography } from '@/components/ui/typography'

const SparkleIcon = () => (
  <svg
    className="w-24 h-24 text-space-purple opacity-20"
    fill="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41L12 0Z" />
    <path d="M19 3L20.5 7.5L25 9L20.5 10.5L19 15L17.5 10.5L13 9L17.5 7.5L19 3Z" />
  </svg>
)

const HexagramIcon = () => (
  <div className="flex flex-col gap-2 w-24 h-24 items-center justify-center opacity-20">
    <div className="w-16 h-2 bg-space-purple rounded" />
    <div className="flex gap-2">
      <div className="w-7 h-2 bg-space-purple rounded" />
      <div className="w-7 h-2 bg-space-purple rounded" />
    </div>
    <div className="w-16 h-2 bg-space-purple rounded" />
    <div className="flex gap-2">
      <div className="w-7 h-2 bg-space-purple rounded" />
      <div className="w-7 h-2 bg-space-purple rounded" />
    </div>
    <div className="w-16 h-2 bg-space-purple rounded" />
    <div className="w-16 h-2 bg-space-purple rounded" />
  </div>
)

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
            <div className="space-y-8 max-w-4xl mx-auto">
              <div className="text-center space-y-2">
                <Typography variant="h2">Select Your Divination Method</Typography>
                <Typography variant="body1" className="text-muted-foreground">
                  Choose how you would like to receive your guidance from the I-Ching
                </Typography>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <Card
                  className="cursor-pointer hover:border-space-purple hover:shadow-lg transition-all duration-200 group relative overflow-hidden"
                  onClick={() => handleSelectGenerationMethod('generate')}
                >
                  <div className="absolute top-4 right-4">
                    <SparkleIcon />
                  </div>
                  <CardHeader className="space-y-3 pb-4">
                    <CardTitle className="text-2xl">Generate with Divination</CardTitle>
                    <CardDescription className="text-base">
                      Let your intuition guide you as you draw on the canvas. The oracle will
                      interpret your movements to generate a hexagram.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div className="flex items-start gap-2">
                        <span className="text-space-purple mt-0.5">✦</span>
                        <span>Intuitive and spontaneous</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-space-purple mt-0.5">✦</span>
                        <span>No prior I-Ching knowledge needed</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-space-purple mt-0.5">✦</span>
                        <span>Quick and meditative</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className="cursor-pointer hover:border-space-purple hover:shadow-lg transition-all duration-200 group relative overflow-hidden"
                  onClick={() => handleSelectGenerationMethod('build')}
                >
                  <div className="absolute top-4 right-4">
                    <HexagramIcon />
                  </div>
                  <CardHeader className="space-y-3 pb-4">
                    <CardTitle className="text-2xl">Enter Hexagram Manually</CardTitle>
                    <CardDescription className="text-base">
                      Already have a hexagram from coins, yarrow stalks, or another method? Enter
                      it here to receive your interpretation.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div className="flex items-start gap-2">
                        <span className="text-space-purple mt-0.5">✦</span>
                        <span>Use traditional methods</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-space-purple mt-0.5">✦</span>
                        <span>For experienced practitioners</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-space-purple mt-0.5">✦</span>
                        <span>Full control over the hexagram</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TransitionWrapper>
        )}
      </AnimatePresence>
    </div>
  )
}
