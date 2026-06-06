'use client'

import { useEffect, useRef, useState } from 'react'
import { ChunkyButton } from '@/components/ui/chunky-button'
import type { GeneratedStory } from '../types'

const ILLUSTRATION_STATUS_MESSAGES = [
  'Painting the scenes...',
  'Bringing characters to life...',
  'Adding colors and shadows...',
  'Sketching the backgrounds...',
  'Polishing the artwork...',
  'Making it magical...',
]

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

function IllustrationGeneratingAnimation({
  progress,
}: {
  progress: { completed: number; total: number }
}) {
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % ILLUSTRATION_STATUS_MESSAGES.length)
    }, 2200)
    return () => clearInterval(interval)
  }, [])

  const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <div className="relative flex items-center justify-center w-20 h-20">
        <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
        <span
          className="material-symbols-outlined text-[32px] text-primary"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          palette
        </span>
      </div>

      <div className="text-center space-y-2">
        <h3 className="font-headline text-xl text-on-surface">Generating Illustrations...</h3>
        <p className="font-body text-body-md text-on-surface-variant">
          {progress.completed} of {progress.total} illustrations complete
        </p>
      </div>

      <div className="w-full max-w-xs">
        <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="font-body text-body-xs text-on-surface-variant text-center mt-1">
          {percent}%
        </p>
      </div>

      <div className="bg-surface-container-high rounded-full px-5 py-2 min-w-[260px] text-center">
        <p
          key={messageIndex}
          className="font-body text-body-sm text-on-surface-variant animate-pulse"
        >
          {ILLUSTRATION_STATUS_MESSAGES[messageIndex]}
        </p>
      </div>
    </div>
  )
}

function SuccessView({
  generatedStory,
  illustrationUrls,
  illustrationError,
  onNext,
}: {
  generatedStory: GeneratedStory
  illustrationUrls: Record<string, string>
  illustrationError: string | null
  onNext: () => void
}) {
  const { layout } = generatedStory
  const pageCount = layout.pages.length
  const illustrationCount = layout.pages
    .flatMap(p => p.panels)
    .filter(panel => panel.type === 'illustration').length
  const completedIllustrations = Object.keys(illustrationUrls).length

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
          {completedIllustrations} of {illustrationCount} illustrations
        </p>
      </div>

      {illustrationError && (
        <p className="font-body text-body-sm text-error">
          Some illustrations could not be generated, but your story is ready.
        </p>
      )}

      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {layout.pages.slice(0, 6).map((page, i) => {
          const firstIllustrationIdx = page.panels.findIndex(p => p.type === 'illustration')
          const thumbKey =
            firstIllustrationIdx >= 0
              ? `page-${page.pageNumber}-panel-${firstIllustrationIdx}`
              : null
          const thumbUrl = thumbKey ? illustrationUrls[thumbKey] : null

          return (
            <div
              key={i}
              className="aspect-[3/4] rounded bg-surface-container-high flex items-center justify-center overflow-hidden"
            >
              {thumbUrl && !thumbUrl.startsWith('/placeholder') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbUrl}
                  alt={`Page ${page.pageNumber}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-headline text-xs text-on-surface-variant">{i + 1}</span>
              )}
            </div>
          )
        })}
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
  illustrationUrls,
  isGeneratingIllustrations,
  illustrationProgress,
  illustrationError,
  generateIllustrations,
}: {
  onNext: () => void
  onPrevious: () => void
  generatedStory: GeneratedStory | null
  isGenerating: boolean
  generationError: string | null
  generateStory: () => Promise<void>
  illustrationUrls: Record<string, string>
  isGeneratingIllustrations: boolean
  illustrationProgress: { completed: number; total: number }
  illustrationError: string | null
  generateIllustrations: () => Promise<void>
}) {
  const hasFiredRef = useRef(false)
  const illustrationFiredRef = useRef(false)

  // Auto-fire story generation on mount
  useEffect(() => {
    if (!hasFiredRef.current && !generatedStory && !isGenerating) {
      hasFiredRef.current = true
      generateStory()
    }
  }, [generatedStory, isGenerating, generateStory])

  // Auto-fire illustration generation once story is ready
  useEffect(() => {
    if (
      generatedStory &&
      !isGenerating &&
      !illustrationFiredRef.current &&
      !isGeneratingIllustrations
    ) {
      illustrationFiredRef.current = true
      generateIllustrations()
    }
  }, [generatedStory, isGenerating, isGeneratingIllustrations, generateIllustrations])

  const isStoryDone = !isGenerating && !generationError && generatedStory
  const isIllustrationDone = isStoryDone && !isGeneratingIllustrations

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

        {isGeneratingIllustrations && (
          <IllustrationGeneratingAnimation progress={illustrationProgress} />
        )}

        {isIllustrationDone && generatedStory && (
          <SuccessView
            generatedStory={generatedStory}
            illustrationUrls={illustrationUrls}
            illustrationError={illustrationError}
            onNext={onNext}
          />
        )}

        {!isGenerating && !generationError && !generatedStory && !isGeneratingIllustrations && (
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
        <ChunkyButton
          variant="secondary"
          onClick={onPrevious}
          disabled={isGenerating || isGeneratingIllustrations}
        >
          <span className="material-symbols-outlined mr-2">arrow_back</span>
          Back
        </ChunkyButton>
        {isIllustrationDone && generatedStory && (
          <ChunkyButton variant="primary" onClick={onNext}>
            Next
            <span className="material-symbols-outlined ml-2">arrow_forward</span>
          </ChunkyButton>
        )}
      </div>
    </div>
  )
}
