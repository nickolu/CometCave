'use client'

import { Step01UploadAndDescribe } from './components/step01-upload-and-describe'
import { Step02StoryConfiguration } from './components/step02-story-configuration'
import { Step03Generation } from './components/step03-generation'
import { Step04ReviewAndRevise } from './components/step04-review-and-revise'
import { useStorybookFactoryState } from './components/useStorybookFactoryState'
import { useWorkflow } from './components/useWorkflow'

export default function StorybookFactory() {
  const { currentStep, nextStep, previousStep } = useWorkflow()
  const _state = useStorybookFactoryState()

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="w-full max-w-screen-lg mt-20">
        <h1 className="font-headline text-4xl font-bold text-center text-on-surface">
          Storybook Factory
        </h1>
        <p className="font-body text-body-lg text-center text-on-surface-variant mt-2">
          Create illustrated stories from your pictures
        </p>

        {currentStep === 0 && <Step01UploadAndDescribe onNext={nextStep} />}
        {currentStep === 1 && (
          <Step02StoryConfiguration onNext={nextStep} onPrevious={previousStep} />
        )}
        {currentStep === 2 && <Step03Generation onNext={nextStep} onPrevious={previousStep} />}
        {currentStep === 3 && <Step04ReviewAndRevise onPrevious={previousStep} />}
      </div>
    </div>
  )
}
