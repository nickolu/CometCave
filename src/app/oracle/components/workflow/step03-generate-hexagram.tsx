import { AnimatePresence } from 'framer-motion'

import { EnterDivinationManually } from '@/app/oracle/components/build-hexagram'
import { GenerateHexagram } from '@/app/oracle/components/generate-hexagram'
import { DivinationQuestion, DivinationResult } from '@/app/oracle/types'

export const Step03GenerateHexagram = ({
  divinationMethod,
  setDivinationResult,
  divinationQuestion,
  onNext,
}: {
  divinationMethod: 'generate' | 'build' | null
  setDivinationResult: (divinationResult: DivinationResult | null) => void
  divinationQuestion: DivinationQuestion
  onNext: () => void
}) => {
  return (
    <div>
      <AnimatePresence mode="wait">
        {divinationMethod === 'generate' && (
          <GenerateHexagram
            divinationQuestion={divinationQuestion}
            setDivinationResult={setDivinationResult}
            onDivinationEntryComplete={divinationResult => {
              setDivinationResult(divinationResult)
              onNext()
            }}
          />
        )}
        {divinationMethod === 'build' && (
          <EnterDivinationManually
            divinationQuestion={divinationQuestion}
            onDivinationEntryComplete={divinationResult => {
              setDivinationResult(divinationResult)
              onNext()
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
