'use client'

import { AnimatePresence } from 'framer-motion'
import { useState } from 'react'

import { Typography } from '@/components/ui/typography'

import { Step01EnterQuestion } from './components/workflow/step01-enter-question'
import { Step02SelectGenerationMethod } from './components/workflow/step02-select-generation-method'
import { Step03GenerateHexagram } from './components/workflow/step03-generate-hexagram'
import { Step04ReviewReading } from './components/workflow/step04-review-changing-lines'
import { Step05ReviewInterpretation } from './components/workflow/step05-review-interpretation'
import { ChangingLines, DivinationResult } from './types'

const OraclePage = () => {
  const [currentStep, setCurrentStep] = useState(0)
  const [divinationQuestion, setDivinationQuestion] = useState('')
  const [divinationResult, setDivinationResult] = useState<DivinationResult | null>(null)
  const [divinationMethod, setDivinationMethod] = useState<'generate' | 'build' | null>(null)

  const handleNextStep = () => {
    setCurrentStep(currentStep + 1)
  }

  // const handlePreviousStep = () => {
  //   setCurrentStep(currentStep - 1)
  // }

  // const handleReset = () => {
  //   setCurrentStep(0)
  //   setDivinationQuestion('')
  //   setAcceptedDivinationDoodle(false)
  // }

  const steps = [
    <Step01EnterQuestion
      key="step01"
      divinationQuestion={divinationQuestion}
      setDivinationQuestion={setDivinationQuestion}
      onNext={handleNextStep}
    />,
    <Step02SelectGenerationMethod
      key="step02"
      divinationMethod={divinationMethod}
      setDivinationMethod={setDivinationMethod}
      onNext={handleNextStep}
    />,
    <Step03GenerateHexagram
      key="step03"
      divinationQuestion={divinationQuestion}
      divinationMethod={divinationMethod}
      setDivinationResult={setDivinationResult}
      onNext={handleNextStep}
    />,
    <Step04ReviewReading key="step04" divinationResult={divinationResult} />,
    <Step05ReviewInterpretation key="step05" divinationResult={divinationResult} />,
  ]

  return (
    <div className="flex flex-col gap-4 text-center pt-10">
      <div className="flex flex-col gap-4 text-center items-center justify-center mt-10">
        <AnimatePresence mode="wait">{steps[currentStep]}</AnimatePresence>
      </div>
    </div>
  )
}

export default OraclePage
