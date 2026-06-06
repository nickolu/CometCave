'use client'

import { useState } from 'react'
import { ChunkyButton } from '@/components/ui/chunky-button'
import type { GeneratedStory, StoryPanel, StoryPage } from '../types'

// --- Panel renderers ---

function IllustrationPanel({
  panel,
  imageUrl,
  isComicStyle,
}: {
  panel: StoryPanel
  imageUrl: string | undefined
  isComicStyle: boolean
}) {
  const borderClass = isComicStyle ? 'border-[3px] border-black' : 'border border-black/10'

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={panel.content}
        className={`w-full h-full object-cover ${borderClass}`}
        draggable={false}
      />
    )
  }

  return (
    <div
      className={`w-full h-full flex flex-col items-center justify-center gap-2 bg-neutral-100 ${borderClass}`}
    >
      <span
        className="material-symbols-outlined text-[32px] text-neutral-400"
        style={{ fontVariationSettings: "'FILL' 0" }}
      >
        image
      </span>
      <p className="font-body text-[10px] text-neutral-500 text-center px-2 leading-tight line-clamp-3">
        {panel.content}
      </p>
    </div>
  )
}

function TextPanel({ panel, isComicStyle }: { panel: StoryPanel; isComicStyle: boolean }) {
  if (isComicStyle) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white border-[3px] border-black p-2 overflow-hidden">
        <p className="font-body text-xs text-black leading-snug text-center">{panel.content}</p>
      </div>
    )
  }
  return (
    <div className="w-full h-full flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-xl p-4 overflow-hidden shadow-sm">
      <p className="font-body text-sm text-on-surface leading-relaxed text-center">
        {panel.content}
      </p>
    </div>
  )
}

function SpeechBubblePanel({ panel, isComicStyle }: { panel: StoryPanel; isComicStyle: boolean }) {
  const containerClass = isComicStyle
    ? 'bg-white border-[2px] border-black rounded-2xl'
    : 'bg-white/90 border border-black/20 rounded-2xl shadow-md'

  return (
    <div className={`w-full h-full flex flex-col p-2 overflow-hidden relative ${containerClass}`}>
      {panel.character && (
        <p
          className={`font-body font-bold text-[10px] uppercase tracking-wide mb-1 ${isComicStyle ? 'text-black' : 'text-on-surface'}`}
        >
          {panel.character}:
        </p>
      )}
      <p
        className={`font-body text-xs leading-snug flex-1 overflow-hidden ${isComicStyle ? 'text-black' : 'text-on-surface'}`}
      >
        {panel.content}
      </p>
      {/* Speech tail — simple triangle at bottom-left */}
      <div
        className="absolute bottom-[-10px] left-4 w-0 h-0"
        style={{
          borderLeft: '8px solid transparent',
          borderRight: '4px solid transparent',
          borderTop: isComicStyle ? '10px solid black' : '10px solid rgba(0,0,0,0.15)',
        }}
      />
      <div
        className="absolute bottom-[-7px] left-[18px] w-0 h-0"
        style={{
          borderLeft: '5px solid transparent',
          borderRight: '3px solid transparent',
          borderTop: '7px solid white',
        }}
      />
    </div>
  )
}

function NarrationBoxPanel({ panel, isComicStyle }: { panel: StoryPanel; isComicStyle: boolean }) {
  const containerClass = isComicStyle
    ? 'bg-amber-50 border-[2px] border-amber-800'
    : 'bg-amber-50/90 border border-amber-200 rounded-lg shadow-sm'

  return (
    <div className={`w-full h-full flex items-center justify-center p-2 overflow-hidden ${containerClass}`}>
      <p
        className={`font-body text-xs italic leading-snug text-center ${isComicStyle ? 'text-amber-900' : 'text-amber-800'}`}
      >
        {panel.content}
      </p>
    </div>
  )
}

function SoundEffectPanel({ panel }: { panel: StoryPanel }) {
  return (
    <div className="w-full h-full flex items-center justify-center overflow-hidden">
      <p
        className="text-red-500 font-bold text-2xl uppercase tracking-wider select-none"
        style={{
          transform: 'rotate(-5deg)',
          textShadow: '2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
        }}
      >
        {panel.content}
      </p>
    </div>
  )
}

// --- Panel dispatcher ---

function PanelRenderer({
  panel,
  panelIndex,
  page,
  illustrationUrls,
  isComicStyle,
}: {
  panel: StoryPanel
  panelIndex: number
  page: StoryPage
  illustrationUrls: Record<string, string>
  isComicStyle: boolean
}) {
  const imageKey = `page-${page.pageNumber}-panel-${panelIndex}`
  const imageUrl = illustrationUrls[imageKey]

  const positionStyle: React.CSSProperties = {
    left: `${panel.position.x}%`,
    top: `${panel.position.y}%`,
    width: `${panel.position.width}%`,
    height: `${panel.position.height}%`,
  }

  return (
    <div className="absolute" style={positionStyle}>
      {panel.type === 'illustration' && (
        <IllustrationPanel panel={panel} imageUrl={imageUrl} isComicStyle={isComicStyle} />
      )}
      {panel.type === 'text' && <TextPanel panel={panel} isComicStyle={isComicStyle} />}
      {panel.type === 'speech-bubble' && (
        <SpeechBubblePanel panel={panel} isComicStyle={isComicStyle} />
      )}
      {panel.type === 'narration-box' && (
        <NarrationBoxPanel panel={panel} isComicStyle={isComicStyle} />
      )}
      {panel.type === 'sound-effect' && <SoundEffectPanel panel={panel} />}
    </div>
  )
}

// --- Page renderer ---

function StoryPageRenderer({
  page,
  illustrationUrls,
  isComicStyle,
}: {
  page: StoryPage
  illustrationUrls: Record<string, string>
  isComicStyle: boolean
}) {
  const isComicGrid = page.layout === 'comic-grid'

  const pageStyle: React.CSSProperties = {}
  if (page.backgroundColor) {
    pageStyle.backgroundColor = page.backgroundColor
  } else if (!page.backgroundColor) {
    pageStyle.backgroundColor = isComicStyle ? '#ffffff' : '#faf7f2'
  }

  const pageBorderClass = isComicGrid
    ? 'border-[4px] border-black'
    : isComicStyle
      ? 'border-[3px] border-black'
      : 'border border-black/10 rounded-lg shadow-lg'

  return (
    <div
      className={`relative w-full aspect-[3/4] overflow-hidden ${pageBorderClass}`}
      style={pageStyle}
    >
      {page.panels.map((panel, idx) => (
        <PanelRenderer
          key={idx}
          panel={panel}
          panelIndex={idx}
          page={page}
          illustrationUrls={illustrationUrls}
          isComicStyle={isComicStyle}
        />
      ))}
    </div>
  )
}

// --- Main Step04 component ---

interface Step04Props {
  generatedStory: GeneratedStory | null
  illustrationUrls: Record<string, string>
  onPrevious: () => void
}

export function Step04ReviewAndRevise({ generatedStory, illustrationUrls, onPrevious }: Step04Props) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0)

  if (!generatedStory) {
    return (
      <div className="space-y-6 mt-6">
        <div className="bg-surface-container rounded-lg p-6 space-y-2">
          <h2 className="font-headline text-2xl text-on-surface">Review &amp; Revise</h2>
          <p className="font-body text-body-md text-on-surface-variant">
            No story generated yet. Go back to generate your story first.
          </p>
        </div>
        <div className="flex justify-start">
          <ChunkyButton variant="secondary" onClick={onPrevious}>
            <span className="material-symbols-outlined mr-2">arrow_back</span>
            Back
          </ChunkyButton>
        </div>
      </div>
    )
  }

  const { layout } = generatedStory
  const pages = layout.pages
  const totalPages = pages.length
  const currentPage = pages[currentPageIndex]
  const isComicStyle = layout.type === 'comic'

  const goToPrevPage = () => setCurrentPageIndex(i => Math.max(0, i - 1))
  const goToNextPage = () => setCurrentPageIndex(i => Math.min(totalPages - 1, i + 1))

  return (
    <div className="space-y-6 mt-6">
      {/* Header */}
      <div className="bg-surface-container rounded-lg p-6 space-y-1">
        <h2 className="font-headline text-2xl text-on-surface">{layout.title}</h2>
        <p className="font-body text-body-sm text-on-surface-variant capitalize">
          {layout.type} &middot; {totalPages} {totalPages === 1 ? 'page' : 'pages'}
        </p>
      </div>

      {/* Page navigation header */}
      <div className="flex items-center justify-between gap-4 px-1">
        <ChunkyButton
          variant="secondary"
          onClick={goToPrevPage}
          disabled={currentPageIndex === 0}
          aria-label="Previous page"
        >
          <span className="material-symbols-outlined">chevron_left</span>
          <span className="hidden sm:inline ml-1">Previous</span>
        </ChunkyButton>

        <span className="font-body text-body-md text-on-surface-variant whitespace-nowrap">
          Page {currentPageIndex + 1} of {totalPages}
        </span>

        <ChunkyButton
          variant="secondary"
          onClick={goToNextPage}
          disabled={currentPageIndex === totalPages - 1}
          aria-label="Next page"
        >
          <span className="hidden sm:inline mr-1">Next</span>
          <span className="material-symbols-outlined">chevron_right</span>
        </ChunkyButton>
      </div>

      {/* Page canvas */}
      <div className="max-w-2xl mx-auto w-full">
        <StoryPageRenderer
          page={currentPage}
          illustrationUrls={illustrationUrls}
          isComicStyle={isComicStyle}
        />
      </div>

      {/* Bottom navigation */}
      <div className="flex items-center justify-between gap-4 px-1">
        <ChunkyButton
          variant="secondary"
          onClick={goToPrevPage}
          disabled={currentPageIndex === 0}
          aria-label="Previous page"
        >
          <span className="material-symbols-outlined">chevron_left</span>
          <span className="hidden sm:inline ml-1">Previous</span>
        </ChunkyButton>

        <span className="font-body text-body-sm text-on-surface-variant whitespace-nowrap">
          Page {currentPageIndex + 1} of {totalPages}
        </span>

        <ChunkyButton
          variant="secondary"
          onClick={goToNextPage}
          disabled={currentPageIndex === totalPages - 1}
          aria-label="Next page"
        >
          <span className="hidden sm:inline mr-1">Next</span>
          <span className="material-symbols-outlined">chevron_right</span>
        </ChunkyButton>
      </div>

      {/* Back to start */}
      <div className="flex justify-start pb-8">
        <ChunkyButton variant="secondary" onClick={onPrevious}>
          <span className="material-symbols-outlined mr-2">arrow_back</span>
          Back to Generation
        </ChunkyButton>
      </div>
    </div>
  )
}
