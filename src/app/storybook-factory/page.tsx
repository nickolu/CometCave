'use client'

import { Step01UploadAndDescribe } from './components/step01-upload-and-describe'
import { Step02StoryConfiguration } from './components/step02-story-configuration'
import { Step03Generation } from './components/step03-generation'
import { Step04ReviewAndRevise } from './components/step04-review-and-revise'
import { useStorybookFactoryState } from './components/useStorybookFactoryState'
import { useWorkflow } from './components/useWorkflow'

export default function StorybookFactory() {
  const { currentStep, nextStep, previousStep } = useWorkflow()
  const state = useStorybookFactoryState()

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="w-full max-w-screen-lg mt-20">
        <h1 className="font-headline text-4xl font-bold text-center text-on-surface">
          Storybook Factory
        </h1>
        <p className="font-body text-body-lg text-center text-on-surface-variant mt-2">
          Create illustrated stories from your pictures
        </p>

        {currentStep === 0 && (
          <Step01UploadAndDescribe
            onNext={nextStep}
            image1Base64={state.image1Base64}
            image2Base64={state.image2Base64}
            caption1={state.caption1}
            caption2={state.caption2}
            storyDirectionPrompt={state.storyDirectionPrompt}
            isLoading={state.isLoading}
            error={state.error}
            setImage1={state.setImage1}
            setImage2={state.setImage2}
            clearImage1={state.clearImage1}
            clearImage2={state.clearImage2}
            setCaption1={state.setCaption1}
            setCaption2={state.setCaption2}
            setStoryDirectionPrompt={state.setStoryDirectionPrompt}
            clearError={state.clearError}
            canProceedFromUpload={state.canProceedFromUpload}
          />
        )}
        {currentStep === 1 && (
          <Step02StoryConfiguration
            onNext={nextStep}
            onPrevious={previousStep}
            storyConfig={state.storyConfig}
            setStoryConfig={state.setStoryConfig}
            isSuggestionsLoading={state.isSuggestionsLoading}
            suggestionsError={state.suggestionsError}
            fetchSuggestions={state.fetchSuggestions}
            suggestionReasoning={state.suggestionReasoning}
          />
        )}
        {currentStep === 2 && (
          <Step03Generation
            onNext={nextStep}
            onPrevious={previousStep}
            generatedStory={state.generatedStory}
            isGenerating={state.isGenerating}
            generationError={state.generationError}
            generateStory={state.generateStory}
            illustrationUrls={state.illustrationUrls}
            isGeneratingIllustrations={state.isGeneratingIllustrations}
            illustrationProgress={state.illustrationProgress}
            illustrationError={state.illustrationError}
            generateIllustrations={state.generateIllustrations}
          />
        )}
        {currentStep === 3 && (
          <Step04ReviewAndRevise
            onPrevious={previousStep}
            generatedStory={state.generatedStory}
            illustrationUrls={state.illustrationUrls}
          />
        )}
      </div>
    </div>
  )
}
