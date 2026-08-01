import { useState } from 'react'

export function useWorkflow() {
  const [currentStep, setCurrentStep] = useState(0)

  const nextStep = () => {
    setCurrentStep(prev => prev + 1)
  }

  const previousStep = () => {
    setCurrentStep(prev => prev - 1)
  }

  return {
    currentStep,
    nextStep,
    previousStep,
  }
}
