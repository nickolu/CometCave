'use client'

import { useRef, useState } from 'react'
import { ChunkyButton } from '@/components/ui/chunky-button'
import { Input } from '@/components/ui/input'
import type { GeneratedStory, StoryPanel, StoryPage } from '../types'

// --- Editable text wrapper ---

function EditableTextContent({
  content,
  displayClassName,
  onSave,
  onCancel,
}: {
  content: string
  displayClassName: string
  onSave: (newContent: string) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(content)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  return (
    <div className="w-full h-full flex flex-col gap-1 p-1">
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        className={`w-full flex-1 resize-none border-2 border-primary rounded-lg bg-transparent p-1 focus:outline-none ${displayClassName}`}
        autoFocus
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            onSave(draft)
          } else if (e.key === 'Escape') {
            onCancel()
          }
        }}
      />
      <div className="flex gap-1 justify-end flex-shrink-0">
        <button
          onClick={() => onSave(draft)}
          className="bg-primary text-on-primary rounded-full w-6 h-6 flex items-center justify-center hover:opacity-90"
          title="Save (Cmd+Enter)"
          aria-label="Save edit"
        >
          <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            check
          </span>
        </button>
        <button
          onClick={onCancel}
          className="bg-surface-container-high text-on-surface rounded-full w-6 h-6 flex items-center justify-center hover:opacity-90"
          title="Cancel (Esc)"
          aria-label="Cancel edit"
        >
          <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 0" }}>
            close
          </span>
        </button>
      </div>
    </div>
  )
}

// --- Panel renderers ---

function IllustrationPanel({
  panel,
  imageUrl,
  isComicStyle,
  isRegenerating,
  onRegenerate,
}: {
  panel: StoryPanel
  imageUrl: string | undefined
  isComicStyle: boolean
  isRegenerating: boolean
  onRegenerate: () => void
}) {
  const borderClass = isComicStyle ? 'border-[3px] border-black' : 'border border-black/10'

  return (
    <div className="relative w-full h-full group">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={panel.content}
          className={`w-full h-full object-cover ${borderClass}`}
          draggable={false}
        />
      ) : (
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
      )}

      {/* Regenerate button — shown on hover */}
      <button
        onClick={e => {
          e.stopPropagation()
          onRegenerate()
        }}
        disabled={isRegenerating}
        className="absolute top-1.5 right-1.5 bg-surface-container hover:bg-primary text-on-surface hover:text-on-primary rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-md disabled:opacity-60"
        title="Regenerate illustration"
        aria-label="Regenerate illustration"
      >
        <span
          className={`material-symbols-outlined text-[16px] ${isRegenerating ? 'animate-spin' : ''}`}
          style={{ fontVariationSettings: "'FILL' 0" }}
        >
          refresh
        </span>
      </button>

      {/* Loading overlay when regenerating */}
      {isRegenerating && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
          <span
            className="material-symbols-outlined text-white text-[32px] animate-spin"
            style={{ fontVariationSettings: "'FILL' 0" }}
          >
            refresh
          </span>
        </div>
      )}
    </div>
  )
}

function TextPanel({
  panel,
  isComicStyle,
  isEditing,
  onEdit,
  onSave,
  onCancel,
}: {
  panel: StoryPanel
  isComicStyle: boolean
  isEditing: boolean
  onEdit: () => void
  onSave: (content: string) => void
  onCancel: () => void
}) {
  if (isEditing) {
    const cls = isComicStyle
      ? 'font-body text-xs text-black leading-snug text-center'
      : 'font-body text-sm text-on-surface leading-relaxed text-center'
    return (
      <div
        className={`w-full h-full ${isComicStyle ? 'bg-white border-[3px] border-black' : 'bg-white/80 backdrop-blur-sm rounded-xl shadow-sm'}`}
      >
        <EditableTextContent content={panel.content} displayClassName={cls} onSave={onSave} onCancel={onCancel} />
      </div>
    )
  }

  if (isComicStyle) {
    return (
      <div
        className="w-full h-full flex items-center justify-center bg-white border-[3px] border-black p-2 overflow-hidden cursor-pointer group border-dashed hover:border-primary/50 transition-colors"
        onClick={onEdit}
        title="Click to edit text"
      >
        <p className="font-body text-xs text-black leading-snug text-center">{panel.content}</p>
        <span
          className="material-symbols-outlined text-[12px] text-primary/60 opacity-0 group-hover:opacity-100 ml-1 flex-shrink-0"
          style={{ fontVariationSettings: "'FILL' 0" }}
        >
          edit
        </span>
      </div>
    )
  }
  return (
    <div
      className="w-full h-full flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-xl p-4 overflow-hidden shadow-sm cursor-pointer group hover:ring-2 hover:ring-dashed hover:ring-outline-variant/50 transition-all"
      onClick={onEdit}
      title="Click to edit text"
    >
      <p className="font-body text-sm text-on-surface leading-relaxed text-center">{panel.content}</p>
      <span
        className="material-symbols-outlined text-[12px] text-on-surface-variant/60 opacity-0 group-hover:opacity-100 ml-1 flex-shrink-0"
        style={{ fontVariationSettings: "'FILL' 0" }}
      >
        edit
      </span>
    </div>
  )
}

function SpeechBubblePanel({
  panel,
  isComicStyle,
  isEditing,
  onEdit,
  onSave,
  onCancel,
}: {
  panel: StoryPanel
  isComicStyle: boolean
  isEditing: boolean
  onEdit: () => void
  onSave: (content: string) => void
  onCancel: () => void
}) {
  const containerClass = isComicStyle
    ? 'bg-white border-[2px] border-black rounded-2xl'
    : 'bg-white/90 border border-black/20 rounded-2xl shadow-md'

  if (isEditing) {
    return (
      <div className={`w-full h-full flex flex-col p-2 overflow-hidden relative ${containerClass}`}>
        {panel.character && (
          <p
            className={`font-body font-bold text-[10px] uppercase tracking-wide mb-1 ${isComicStyle ? 'text-black' : 'text-on-surface'}`}
          >
            {panel.character}:
          </p>
        )}
        <EditableTextContent
          content={panel.content}
          displayClassName={`font-body text-xs leading-snug ${isComicStyle ? 'text-black' : 'text-on-surface'}`}
          onSave={onSave}
          onCancel={onCancel}
        />
      </div>
    )
  }

  return (
    <div
      className={`w-full h-full flex flex-col p-2 overflow-hidden relative ${containerClass} cursor-pointer group hover:ring-2 hover:ring-dashed hover:ring-outline-variant/50 transition-all`}
      onClick={onEdit}
      title="Click to edit speech"
    >
      {panel.character && (
        <p
          className={`font-body font-bold text-[10px] uppercase tracking-wide mb-1 ${isComicStyle ? 'text-black' : 'text-on-surface'}`}
        >
          {panel.character}:
        </p>
      )}
      <div className="flex items-start gap-1 flex-1 overflow-hidden">
        <p
          className={`font-body text-xs leading-snug flex-1 overflow-hidden ${isComicStyle ? 'text-black' : 'text-on-surface'}`}
        >
          {panel.content}
        </p>
        <span
          className="material-symbols-outlined text-[12px] text-on-surface-variant/60 opacity-0 group-hover:opacity-100 flex-shrink-0"
          style={{ fontVariationSettings: "'FILL' 0" }}
        >
          edit
        </span>
      </div>
      {/* Speech tail */}
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

function NarrationBoxPanel({
  panel,
  isComicStyle,
  isEditing,
  onEdit,
  onSave,
  onCancel,
}: {
  panel: StoryPanel
  isComicStyle: boolean
  isEditing: boolean
  onEdit: () => void
  onSave: (content: string) => void
  onCancel: () => void
}) {
  const containerClass = isComicStyle
    ? 'bg-amber-50 border-[2px] border-amber-800'
    : 'bg-amber-50/90 border border-amber-200 rounded-lg shadow-sm'

  if (isEditing) {
    return (
      <div className={`w-full h-full flex items-center justify-center p-2 overflow-hidden ${containerClass}`}>
        <EditableTextContent
          content={panel.content}
          displayClassName={`font-body text-xs italic leading-snug text-center ${isComicStyle ? 'text-amber-900' : 'text-amber-800'}`}
          onSave={onSave}
          onCancel={onCancel}
        />
      </div>
    )
  }

  return (
    <div
      className={`w-full h-full flex items-center justify-center p-2 overflow-hidden ${containerClass} cursor-pointer group hover:ring-2 hover:ring-dashed hover:ring-amber-400/50 transition-all`}
      onClick={onEdit}
      title="Click to edit narration"
    >
      <div className="flex items-center gap-1">
        <p
          className={`font-body text-xs italic leading-snug text-center ${isComicStyle ? 'text-amber-900' : 'text-amber-800'}`}
        >
          {panel.content}
        </p>
        <span
          className="material-symbols-outlined text-[12px] text-amber-600/60 opacity-0 group-hover:opacity-100 flex-shrink-0"
          style={{ fontVariationSettings: "'FILL' 0" }}
        >
          edit
        </span>
      </div>
    </div>
  )
}

function SoundEffectPanel({
  panel,
  isEditing,
  onEdit,
  onSave,
  onCancel,
}: {
  panel: StoryPanel
  isEditing: boolean
  onEdit: () => void
  onSave: (content: string) => void
  onCancel: () => void
}) {
  if (isEditing) {
    return (
      <div className="w-full h-full flex items-center justify-center overflow-hidden p-1">
        <EditableTextContent
          content={panel.content}
          displayClassName="text-red-500 font-bold text-2xl uppercase tracking-wider text-center"
          onSave={onSave}
          onCancel={onCancel}
        />
      </div>
    )
  }

  return (
    <div
      className="w-full h-full flex items-center justify-center overflow-hidden cursor-pointer group hover:opacity-80 transition-opacity"
      onClick={onEdit}
      title="Click to edit sound effect"
    >
      <p
        className="text-red-500 font-bold text-2xl uppercase tracking-wider select-none"
        style={{
          transform: 'rotate(-5deg)',
          textShadow: '2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
        }}
      >
        {panel.content}
      </p>
      <span
        className="material-symbols-outlined text-[12px] text-on-surface-variant/60 opacity-0 group-hover:opacity-100 ml-1 flex-shrink-0"
        style={{ fontVariationSettings: "'FILL' 0" }}
      >
        edit
      </span>
    </div>
  )
}

// --- Panel dispatcher ---

function PanelRenderer({
  panel,
  panelIndex,
  pageIndex,
  page,
  illustrationUrls,
  isComicStyle,
  isEditing,
  isRegeneratingIllustration,
  onEdit,
  onSave,
  onCancel,
  onRegenerateIllustration,
}: {
  panel: StoryPanel
  panelIndex: number
  pageIndex: number
  page: StoryPage
  illustrationUrls: Record<string, string>
  isComicStyle: boolean
  isEditing: boolean
  isRegeneratingIllustration: boolean
  onEdit: () => void
  onSave: (content: string) => void
  onCancel: () => void
  onRegenerateIllustration: () => void
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
        <IllustrationPanel
          panel={panel}
          imageUrl={imageUrl}
          isComicStyle={isComicStyle}
          isRegenerating={isRegeneratingIllustration}
          onRegenerate={onRegenerateIllustration}
        />
      )}
      {panel.type === 'text' && (
        <TextPanel
          panel={panel}
          isComicStyle={isComicStyle}
          isEditing={isEditing}
          onEdit={onEdit}
          onSave={onSave}
          onCancel={onCancel}
        />
      )}
      {panel.type === 'speech-bubble' && (
        <SpeechBubblePanel
          panel={panel}
          isComicStyle={isComicStyle}
          isEditing={isEditing}
          onEdit={onEdit}
          onSave={onSave}
          onCancel={onCancel}
        />
      )}
      {panel.type === 'narration-box' && (
        <NarrationBoxPanel
          panel={panel}
          isComicStyle={isComicStyle}
          isEditing={isEditing}
          onEdit={onEdit}
          onSave={onSave}
          onCancel={onCancel}
        />
      )}
      {panel.type === 'sound-effect' && (
        <SoundEffectPanel
          panel={panel}
          isEditing={isEditing}
          onEdit={onEdit}
          onSave={onSave}
          onCancel={onCancel}
        />
      )}
    </div>
  )
}

// --- Page renderer ---

function StoryPageRenderer({
  page,
  pageIndex,
  illustrationUrls,
  isComicStyle,
  editingPanel,
  regeneratingPanels,
  onEditPanel,
  onSavePanel,
  onCancelEdit,
  onRegenerateIllustration,
}: {
  page: StoryPage
  pageIndex: number
  illustrationUrls: Record<string, string>
  isComicStyle: boolean
  editingPanel: { pageIndex: number; panelIndex: number } | null
  regeneratingPanels: Set<string>
  onEditPanel: (pageIndex: number, panelIndex: number) => void
  onSavePanel: (pageIndex: number, panelIndex: number, content: string) => void
  onCancelEdit: () => void
  onRegenerateIllustration: (pageIndex: number, panelIndex: number, prompt: string) => void
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
      {page.panels.map((panel, idx) => {
        const regenKey = `page-${page.pageNumber}-panel-${idx}`
        const isThisPanelEditing =
          editingPanel?.pageIndex === pageIndex && editingPanel?.panelIndex === idx
        return (
          <PanelRenderer
            key={idx}
            panel={panel}
            panelIndex={idx}
            pageIndex={pageIndex}
            page={page}
            illustrationUrls={illustrationUrls}
            isComicStyle={isComicStyle}
            isEditing={isThisPanelEditing}
            isRegeneratingIllustration={regeneratingPanels.has(regenKey)}
            onEdit={() => onEditPanel(pageIndex, idx)}
            onSave={content => onSavePanel(pageIndex, idx, content)}
            onCancel={onCancelEdit}
            onRegenerateIllustration={() => onRegenerateIllustration(pageIndex, idx, panel.content)}
          />
        )
      })}
    </div>
  )
}

// --- Main Step04 component ---

interface Step04Props {
  generatedStory: GeneratedStory | null
  illustrationUrls: Record<string, string>
  editingPanel: { pageIndex: number; panelIndex: number } | null
  setEditingPanel: (panel: { pageIndex: number; panelIndex: number } | null) => void
  updatePanelContent: (pageIndex: number, panelIndex: number, content: string) => void
  revisionPrompt: string
  setRevisionPrompt: (prompt: string) => void
  isRevising: boolean
  revisionError: string | null
  reviseStory: () => Promise<void>
  regenerateStory: () => Promise<void>
  regenerateIllustration: (pageNumber: number, panelIndex: number, prompt: string) => Promise<void>
  onPrevious: () => void
}

export function Step04ReviewAndRevise({
  generatedStory,
  illustrationUrls,
  editingPanel,
  setEditingPanel,
  updatePanelContent,
  revisionPrompt,
  setRevisionPrompt,
  isRevising,
  revisionError,
  reviseStory,
  regenerateStory,
  regenerateIllustration,
  onPrevious,
}: Step04Props) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [regeneratingPanels, setRegeneratingPanels] = useState<Set<string>>(new Set())
  const [isRegeneratingAll, setIsRegeneratingAll] = useState(false)

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

  const goToPrevPage = () => {
    setEditingPanel(null)
    setCurrentPageIndex(i => Math.max(0, i - 1))
  }
  const goToNextPage = () => {
    setEditingPanel(null)
    setCurrentPageIndex(i => Math.min(totalPages - 1, i + 1))
  }

  const handleEditPanel = (pageIndex: number, panelIndex: number) => {
    setEditingPanel({ pageIndex, panelIndex })
  }

  const handleSavePanel = (pageIndex: number, panelIndex: number, content: string) => {
    updatePanelContent(pageIndex, panelIndex, content)
    setEditingPanel(null)
  }

  const handleRegenerateIllustration = async (pageIndex: number, panelIndex: number, prompt: string) => {
    const page = pages[pageIndex]
    if (!page) return
    const key = `page-${page.pageNumber}-panel-${panelIndex}`
    setRegeneratingPanels(prev => new Set(prev).add(key))
    try {
      await regenerateIllustration(page.pageNumber, panelIndex, prompt)
    } finally {
      setRegeneratingPanels(prev => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  const handleRegenerateAll = async () => {
    if (!window.confirm('Regenerate the entire story? This will replace all pages and panels.')) return
    setIsRegeneratingAll(true)
    try {
      await regenerateStory()
      setCurrentPageIndex(0)
    } finally {
      setIsRegeneratingAll(false)
    }
  }

  const handleReviseSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await reviseStory()
  }

  return (
    <div className="space-y-6 mt-6">
      {/* Header with title and Regenerate All */}
      <div className="bg-surface-container rounded-lg p-6 space-y-1">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-headline text-2xl text-on-surface">{layout.title}</h2>
            <p className="font-body text-body-sm text-on-surface-variant capitalize">
              {layout.type} &middot; {totalPages} {totalPages === 1 ? 'page' : 'pages'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Print button */}
            <button
              onClick={() => window.print()}
              className="bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl px-4 py-2 flex items-center gap-2 print:hidden"
              title="Print story"
            >
              <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 0" }}>
                print
              </span>
              <span className="hidden sm:inline text-sm">Print</span>
            </button>
            <ChunkyButton
              variant="secondary"
              size="sm"
              onClick={handleRegenerateAll}
              disabled={isRegeneratingAll || isRevising}
              title="Regenerate the entire story from scratch"
            >
              <span
                className={`material-symbols-outlined text-[16px] ${isRegeneratingAll ? 'animate-spin' : ''}`}
                style={{ fontVariationSettings: "'FILL' 0" }}
              >
                autorenew
              </span>
              <span className="hidden sm:inline">Regenerate All</span>
            </ChunkyButton>
          </div>
        </div>
      </div>

      {/* Interactive view — hidden when printing */}
      <div className="print:hidden">
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
        <div className="max-w-2xl mx-auto w-full mt-6">
          <StoryPageRenderer
            page={currentPage}
            pageIndex={currentPageIndex}
            illustrationUrls={illustrationUrls}
            isComicStyle={isComicStyle}
            editingPanel={editingPanel}
            regeneratingPanels={regeneratingPanels}
            onEditPanel={handleEditPanel}
            onSavePanel={handleSavePanel}
            onCancelEdit={() => setEditingPanel(null)}
            onRegenerateIllustration={handleRegenerateIllustration}
          />
        </div>

        {/* Revision prompt bar */}
        <div className="max-w-2xl mx-auto w-full bg-surface-container-high p-4 rounded-xl space-y-3 mt-6">
          <p className="font-body text-body-sm text-on-surface-variant">
            Describe a revision to apply to the whole story (e.g., &ldquo;make it funnier&rdquo;, &ldquo;add a dragon to page 3&rdquo;):
          </p>
          <form onSubmit={handleReviseSubmit} className="flex gap-2">
            <Input
              value={revisionPrompt}
              onChange={e => setRevisionPrompt(e.target.value)}
              placeholder="e.g., make the ending more dramatic…"
              disabled={isRevising}
              className="flex-1"
            />
            <ChunkyButton
              type="submit"
              variant="primary"
              size="md"
              disabled={isRevising || !revisionPrompt.trim()}
            >
              {isRevising ? (
                <>
                  <span
                    className="material-symbols-outlined text-[16px] animate-spin"
                    style={{ fontVariationSettings: "'FILL' 0" }}
                  >
                    refresh
                  </span>
                  <span className="hidden sm:inline">Revising…</span>
                </>
              ) : (
                <>
                  <span
                    className="material-symbols-outlined text-[16px]"
                    style={{ fontVariationSettings: "'FILL' 0" }}
                  >
                    auto_fix_high
                  </span>
                  <span className="hidden sm:inline">Revise</span>
                </>
              )}
            </ChunkyButton>
          </form>
          {revisionError && (
            <p className="font-body text-body-sm text-ds-error">{revisionError}</p>
          )}
        </div>

        {/* Bottom navigation */}
        <div className="flex items-center justify-between gap-4 px-1 mt-6">
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
        <div className="flex justify-start pb-8 mt-6">
          <ChunkyButton variant="secondary" onClick={onPrevious}>
            <span className="material-symbols-outlined mr-2">arrow_back</span>
            Back to Generation
          </ChunkyButton>
        </div>
      </div>

      {/* Print-only: all pages rendered for printing */}
      <div className="hidden print:block">
        {/* Title page */}
        <div className="text-center py-8 break-after-page">
          <h1 className="text-4xl font-headline font-bold text-black">{layout.title}</h1>
          <p className="text-xl mt-4 capitalize text-black">{layout.type}</p>
        </div>

        {/* All story pages */}
        {pages.map((page, pageIndex) => {
          const pageStyle: React.CSSProperties = {
            backgroundColor: page.backgroundColor || (isComicStyle ? '#ffffff' : '#faf7f2'),
          }
          const pageBorderClass =
            page.layout === 'comic-grid'
              ? 'border-[4px] border-black'
              : isComicStyle
                ? 'border-[3px] border-black'
                : 'border border-black/10'

          return (
            <div key={pageIndex} className="break-after-page">
              <div
                className={`relative w-full aspect-[3/4] mx-auto overflow-hidden ${pageBorderClass}`}
                style={pageStyle}
              >
                {page.panels.map((panel, panelIndex) => {
                  const imageKey = `page-${page.pageNumber}-panel-${panelIndex}`
                  const imageUrl = illustrationUrls[imageKey]
                  const positionStyle: React.CSSProperties = {
                    left: `${panel.position.x}%`,
                    top: `${panel.position.y}%`,
                    width: `${panel.position.width}%`,
                    height: `${panel.position.height}%`,
                  }

                  return (
                    <div key={panelIndex} className="absolute" style={positionStyle}>
                      {panel.type === 'illustration' && (
                        imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={panel.content}
                            className={`w-full h-full object-cover ${isComicStyle ? 'border-[3px] border-black' : 'border border-black/10'}`}
                            draggable={false}
                          />
                        ) : (
                          <div
                            className={`w-full h-full flex flex-col items-center justify-center gap-2 bg-neutral-100 ${isComicStyle ? 'border-[3px] border-black' : 'border border-black/10'}`}
                          >
                            <p className="font-body text-[10px] text-neutral-500 text-center px-2 leading-tight">
                              {panel.content}
                            </p>
                          </div>
                        )
                      )}
                      {panel.type === 'text' && (
                        <div
                          className={`w-full h-full flex items-center justify-center p-2 overflow-hidden ${isComicStyle ? 'bg-white border-[3px] border-black' : 'bg-white/80 rounded-xl shadow-sm'}`}
                        >
                          <p className={`font-body text-center ${isComicStyle ? 'text-xs text-black leading-snug' : 'text-sm text-black leading-relaxed'}`}>
                            {panel.content}
                          </p>
                        </div>
                      )}
                      {panel.type === 'speech-bubble' && (
                        <div
                          className={`w-full h-full flex flex-col p-2 overflow-hidden relative ${isComicStyle ? 'bg-white border-[2px] border-black rounded-2xl' : 'bg-white/90 border border-black/20 rounded-2xl shadow-md'}`}
                        >
                          {panel.character && (
                            <p className="font-body font-bold text-[10px] uppercase tracking-wide mb-1 text-black">
                              {panel.character}:
                            </p>
                          )}
                          <p className="font-body text-xs leading-snug text-black flex-1 overflow-hidden">
                            {panel.content}
                          </p>
                          {/* Speech tail */}
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
                      )}
                      {panel.type === 'narration-box' && (
                        <div
                          className={`w-full h-full flex items-center justify-center p-2 overflow-hidden ${isComicStyle ? 'bg-amber-50 border-[2px] border-amber-800' : 'bg-amber-50/90 border border-amber-200 rounded-lg shadow-sm'}`}
                        >
                          <p className={`font-body text-xs italic leading-snug text-center ${isComicStyle ? 'text-amber-900' : 'text-amber-800'}`}>
                            {panel.content}
                          </p>
                        </div>
                      )}
                      {panel.type === 'sound-effect' && (
                        <div className="w-full h-full flex items-center justify-center overflow-hidden">
                          <p
                            className="text-red-500 font-bold text-2xl uppercase tracking-wider"
                            style={{
                              transform: 'rotate(-5deg)',
                              textShadow: '2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
                            }}
                          >
                            {panel.content}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
