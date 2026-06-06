import { useState } from 'react'

export function useWorkflow() {
  const [currentStep, setCurrentStep] = useState(0)

  const nextStep = () => {
    setCurrentStep(prev => Math.min(prev + 1, 3))
  }

  const previousStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0))
  }

  return {
    currentStep,
    nextStep,
    previousStep,
  }
}
