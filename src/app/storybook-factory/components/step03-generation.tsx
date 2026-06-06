'use client'

import { useEffect, useRef, useState } from 'react'
import { ChunkyButton } from '@/components/ui/chunky-button'
import type { GeneratedStory } from '../types'

const STATUS_MESSAGES = [
  'Writing the plot...',
  'Designing the layouts...',
  'Crafting dialogue...',
  'Sketching the panels...',
  'Adding the finishing touches...',
  'Bringing characters to life...',
  'Setting the scenes...',
  'Choosing the perfect words...',
]

function GeneratingAnimation() {
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % STATUS_MESSAGES.length)
    }, 2200)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <div className="relative flex items-center justify-center w-20 h-20">
        <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
        <span
          className="material-symbols-outlined text-[32px] text-primary"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          auto_stories
        </span>
      </div>

      <div className="text-center space-y-2">
        <h3 className="font-headline text-xl text-on-surface">Creating Your Story...</h3>
        <p className="font-body text-body-md text-on-surface-variant">
          Our AI is crafting your illustrated story
        </p>
      </div>

      <div className="bg-surface-container-high rounded-full px-5 py-2 min-w-[260px] text-center">
        <p
          key={messageIndex}
          className="font-body text-body-sm text-on-surface-variant animate-pulse"
        >
          {STATUS_MESSAGES[messageIndex]}
        </p>
      </div>
    </div>
  )
}

function SuccessView({
  generatedStory,
  onNext,
}: {
  generatedStory: GeneratedStory
  onNext: () => void
}) {
  const { layout } = generatedStory
  const pageCount = layout.pages.length
  const illustrationCount = layout.pages
    .flatMap(p => p.panels)
    .filter(panel => panel.type === 'illustration').length

  return (
    <div className="flex flex-col items-center gap-6 py-6 text-center">
      <div className="flex items-center justify-center w-20 h-20 rounded-full bg-[color-mix(in_srgb,var(--color-primary)_15%,transparent)]">
        <span
          className="material-symbols-outlined text-[40px] text-primary"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          check_circle
        </span>
      </div>

      <div className="space-y-2">
        <h3 className="font-headline text-2xl text-on-surface">{layout.title}</h3>
        <p className="font-body text-body-md text-on-surface-variant capitalize">
          {layout.type} &middot; {pageCount} {pageCount === 1 ? 'page' : 'pages'} &middot;{' '}
          {illustrationCount} illustrations
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {[...Array(Math.min(pageCount, 6))].map((_, i) => (
          <div
            key={i}
            className="aspect-[3/4] rounded bg-surface-container-high flex items-center justify-center"
          >
            <span className="font-headline text-xs text-on-surface-variant">
              {i + 1}
            </span>
          </div>
        ))}
        {pageCount > 6 && (
          <div className="aspect-[3/4] rounded bg-surface-container-high flex items-center justify-center">
            <span className="font-body text-body-xs text-on-surface-variant">
              +{pageCount - 6}
            </span>
          </div>
        )}
      </div>

      <ChunkyButton variant="primary" onClick={onNext} className="w-full max-w-xs">
        <span
          className="material-symbols-outlined mr-2"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          menu_book
        </span>
        View Your Story
      </ChunkyButton>
    </div>
  )
}

export function Step03Generation({
  onNext,
  onPrevious,
  generatedStory,
  isGenerating,
  generationError,
  generateStory,
}: {
  onNext: () => void
  onPrevious: () => void
  generatedStory: GeneratedStory | null
  isGenerating: boolean
  generationError: string | null
  generateStory: () => Promise<void>
}) {
  const hasFiredRef = useRef(false)

  useEffect(() => {
    if (!hasFiredRef.current && !generatedStory && !isGenerating) {
      hasFiredRef.current = true
      generateStory()
    }
  }, [generatedStory, isGenerating, generateStory])

  return (
    <div className="space-y-6 mt-6">
      <div className="bg-surface-container rounded-lg p-6 space-y-2">
        <h2 className="font-headline text-2xl text-on-surface">Generating Your Story</h2>
        <p className="font-body text-body-md text-on-surface-variant">
          AI is crafting your illustrated story — sit tight!
        </p>
      </div>

      <div className="bg-surface-container rounded-lg p-6">
        {isGenerating && <GeneratingAnimation />}

        {!isGenerating && generationError && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <span
              className="material-symbols-outlined text-[48px] text-error"
              style={{ fontVariationSettings: "'FILL' 0" }}
            >
              error
            </span>
            <div className="space-y-1">
              <p className="font-body text-body-md text-on-surface">{generationError}</p>
            </div>
            <ChunkyButton
              variant="secondary"
              onClick={() => {
                hasFiredRef.current = true
                generateStory()
              }}
            >
              <span className="material-symbols-outlined mr-2">refresh</span>
              Try Again
            </ChunkyButton>
          </div>
        )}

        {!isGenerating && !generationError && generatedStory && (
          <SuccessView generatedStory={generatedStory} onNext={onNext} />
        )}

        {!isGenerating && !generationError && !generatedStory && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <span
              className="material-symbols-outlined text-[48px] text-on-surface-variant"
              style={{ fontVariationSettings: "'FILL' 0" }}
            >
              hourglass_empty
            </span>
            <p className="font-body text-body-md text-on-surface-variant">
              Preparing to generate your story...
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <ChunkyButton variant="secondary" onClick={onPrevious} disabled={isGenerating}>
          <span className="material-symbols-outlined mr-2">arrow_back</span>
          Back
        </ChunkyButton>
        {generatedStory && !isGenerating && (
          <ChunkyButton variant="primary" onClick={onNext}>
            Next
            <span className="material-symbols-outlined ml-2">arrow_forward</span>
          </ChunkyButton>
        )}
      </div>
    </div>
  )
}
