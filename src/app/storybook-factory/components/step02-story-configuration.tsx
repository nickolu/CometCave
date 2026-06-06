'use client'

import { useEffect } from 'react'
import { ChunkyButton } from '@/components/ui/chunky-button'
import type { StoryConfiguration } from './useStorybookFactoryState'

// ─── Option Selector ──────────────────────────────────────────────────────────

interface OptionItem<T extends string | number> {
  value: T
  label: string
  emoji?: string
}

function OptionSelector<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: OptionItem<T>[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map(opt => {
        const selected = opt.value === value
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            className={[
              'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors',
              selected
                ? 'bg-primary text-on-primary border-primary'
                : 'bg-surface-container text-on-surface border-surface-variant/40 hover:bg-surface-variant/20',
            ].join(' ')}
          >
            {opt.emoji && <span>{opt.emoji}</span>}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-headline text-base text-on-surface-variant uppercase tracking-wide mb-3">
      {children}
    </h3>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Step02StoryConfiguration({
  onNext,
  onPrevious,
  storyConfig,
  setStoryConfig,
  isSuggestionsLoading,
  suggestionsError,
  fetchSuggestions,
  suggestionReasoning,
}: {
  onNext: () => void
  onPrevious: () => void
  storyConfig: StoryConfiguration
  setStoryConfig: (updates: Partial<StoryConfiguration>) => void
  isSuggestionsLoading: boolean
  suggestionsError: string | null
  fetchSuggestions: () => Promise<void>
  suggestionReasoning: string | null
}) {
  // Fetch AI suggestions when user arrives at this step
  useEffect(() => {
    fetchSuggestions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const storyTypeOptions: OptionItem<StoryConfiguration['storyType']>[] = [
    { value: 'comic', label: 'Comic Book', emoji: '⭐' },
    { value: 'storybook', label: 'Storybook', emoji: '📖' },
    { value: 'fairy-tale', label: 'Fairy Tale', emoji: '🏰' },
    { value: 'adventure', label: 'Adventure', emoji: '🗺️' },
  ]

  const artStyleOptions: OptionItem<StoryConfiguration['artStyle']>[] = [
    { value: 'cartoon', label: 'Cartoon', emoji: '🎨' },
    { value: 'anime', label: 'Anime', emoji: '✨' },
    { value: 'watercolor', label: 'Watercolor', emoji: '🖌️' },
    { value: 'pixel-art', label: 'Pixel Art', emoji: '🕹️' },
    { value: 'realistic', label: 'Realistic', emoji: '📸' },
  ]

  const toneOptions: OptionItem<StoryConfiguration['tone']>[] = [
    { value: 'funny', label: 'Funny', emoji: '😄' },
    { value: 'dramatic', label: 'Dramatic', emoji: '🎭' },
    { value: 'scary', label: 'Scary', emoji: '👻' },
    { value: 'heartwarming', label: 'Heartwarming', emoji: '💛' },
  ]

  const panelsOptions: OptionItem<number>[] = [2, 3, 4, 5, 6].map(n => ({
    value: n,
    label: String(n),
  }))

  const dialogueOptions: OptionItem<StoryConfiguration['dialogueStyle']>[] = [
    { value: 'speech-bubbles', label: 'Speech Bubbles', emoji: '💬' },
    { value: 'narration-boxes', label: 'Narration Boxes', emoji: '📝' },
    { value: 'mixed', label: 'Mixed', emoji: '🔀' },
  ]

  return (
    <div className="space-y-6 mt-6">
      {/* Header */}
      <div className="bg-surface-container rounded-lg p-6 space-y-1">
        <h2 className="font-headline text-2xl text-on-surface">Configure Your Story</h2>
        <p className="font-body text-body-md text-on-surface-variant">
          Customize how your story will look and feel.
        </p>
      </div>

      {/* AI Suggestion Banner */}
      <div className="bg-surface-container rounded-lg p-4">
        {isSuggestionsLoading ? (
          <div className="flex items-center gap-3 text-on-surface-variant">
            <span
              className="material-symbols-outlined animate-spin text-[20px]"
              style={{ fontVariationSettings: "'FILL' 0" }}
            >
              progress_activity
            </span>
            <span className="font-body text-body-sm">
              Analyzing your images to suggest settings…
            </span>
          </div>
        ) : suggestionsError ? (
          <div className="flex items-start gap-3 text-on-surface-variant">
            <span
              className="material-symbols-outlined text-[20px] mt-0.5 shrink-0"
              style={{ fontVariationSettings: "'FILL' 0" }}
            >
              info
            </span>
            <span className="font-body text-body-sm">{suggestionsError}</span>
          </div>
        ) : suggestionReasoning ? (
          <div className="flex items-start gap-3">
            <span
              className="material-symbols-outlined text-[20px] mt-0.5 shrink-0 text-primary"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              auto_awesome
            </span>
            <div>
              <p className="font-body text-body-sm font-semibold text-on-surface mb-0.5">
                AI suggestion
              </p>
              <p className="font-body text-body-sm text-on-surface-variant">
                {suggestionReasoning}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Story Type */}
      <div className="bg-surface-container rounded-lg p-6">
        <SectionLabel>Story Type</SectionLabel>
        <OptionSelector
          options={storyTypeOptions}
          value={storyConfig.storyType}
          onChange={v => setStoryConfig({ storyType: v })}
        />
      </div>

      {/* Art Style */}
      <div className="bg-surface-container rounded-lg p-6">
        <SectionLabel>Art Style</SectionLabel>
        <OptionSelector
          options={artStyleOptions}
          value={storyConfig.artStyle}
          onChange={v => setStoryConfig({ artStyle: v })}
        />
      </div>

      {/* Length */}
      <div className="bg-surface-container rounded-lg p-6">
        <SectionLabel>Length — {storyConfig.pageCount} pages</SectionLabel>
        <input
          type="range"
          min={4}
          max={24}
          step={2}
          value={storyConfig.pageCount}
          onChange={e => setStoryConfig({ pageCount: Number(e.target.value) })}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-on-surface-variant font-body text-body-sm mt-1">
          <span>4 pages</span>
          <span>24 pages</span>
        </div>
      </div>

      {/* Tone */}
      <div className="bg-surface-container rounded-lg p-6">
        <SectionLabel>Tone</SectionLabel>
        <OptionSelector
          options={toneOptions}
          value={storyConfig.tone}
          onChange={v => setStoryConfig({ tone: v })}
        />
      </div>

      {/* Comic-specific options */}
      {storyConfig.storyType === 'comic' && (
        <div className="bg-surface-container rounded-lg p-6 space-y-6">
          <div>
            <SectionLabel>Panels per Page</SectionLabel>
            <OptionSelector
              options={panelsOptions}
              value={storyConfig.panelsPerPage}
              onChange={v => setStoryConfig({ panelsPerPage: v })}
            />
          </div>
          <div>
            <SectionLabel>Dialogue Style</SectionLabel>
            <OptionSelector
              options={dialogueOptions}
              value={storyConfig.dialogueStyle}
              onChange={v => setStoryConfig({ dialogueStyle: v })}
            />
          </div>
        </div>
      )}

      {/* Additional Notes */}
      <div className="bg-surface-container rounded-lg p-6">
        <SectionLabel>Additional Notes</SectionLabel>
        <textarea
          placeholder="Any other details about your story? (optional)"
          value={storyConfig.additionalNotes}
          onChange={e => setStoryConfig({ additionalNotes: e.target.value })}
          rows={3}
          className="w-full bg-surface rounded-lg border border-surface-variant/40 px-4 py-3 font-body text-body-md text-on-surface placeholder:text-on-surface-variant resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* Navigation */}
      <div className="flex justify-between pb-6">
        <ChunkyButton variant="secondary" onClick={onPrevious}>
          <span className="material-symbols-outlined mr-2">arrow_back</span>
          Back
        </ChunkyButton>
        <ChunkyButton variant="primary" onClick={onNext}>
          Next
          <span className="material-symbols-outlined ml-2">arrow_forward</span>
        </ChunkyButton>
      </div>
    </div>
  )
}
