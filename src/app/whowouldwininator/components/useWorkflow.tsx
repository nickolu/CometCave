import { useState } from 'react'

export function useWorkflow() {
  const [currentStep, setCurrentStep] = useState(0)

  const nextStep = () => {
    setCurrentStep(currentStep + 1)
  }

  const previousStep = () => {
    setCurrentStep(currentStep - 1)
  }

  return {
    currentStep,
    nextStep,
    previousStep,
  }
}
