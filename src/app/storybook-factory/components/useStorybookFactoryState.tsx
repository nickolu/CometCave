'use client'

import { useState } from 'react'
import type { GeneratedStory } from '../types'

export interface StoryConfiguration {
  storyType: 'comic' | 'storybook' | 'fairy-tale' | 'adventure'
  artStyle: 'cartoon' | 'anime' | 'watercolor' | 'pixel-art' | 'realistic'
  pageCount: number
  tone: 'funny' | 'dramatic' | 'scary' | 'heartwarming'
  panelsPerPage: number
  dialogueStyle: 'speech-bubbles' | 'narration-boxes' | 'mixed'
  additionalNotes: string
}

const DEFAULT_STORY_CONFIG: StoryConfiguration = {
  storyType: 'comic',
  artStyle: 'cartoon',
  pageCount: 8,
  tone: 'funny',
  panelsPerPage: 4,
  dialogueStyle: 'speech-bubbles',
  additionalNotes: '',
}

export interface StorybookFactoryState {
  image1Base64: string | null
  image2Base64: string | null
  caption1: string
  caption2: string
  storyDirectionPrompt: string
  isLoading: boolean
  error: string | null
  setImage1: (file: File) => void
  setImage2: (file: File) => void
  clearImage1: () => void
  clearImage2: () => void
  setCaption1: (text: string) => void
  setCaption2: (text: string) => void
  setStoryDirectionPrompt: (text: string) => void
  clearError: () => void
  canProceedFromUpload: boolean

  // Story configuration
  storyConfig: StoryConfiguration
  setStoryConfig: (updates: Partial<StoryConfiguration>) => void
  isSuggestionsLoading: boolean
  suggestionsError: string | null
  fetchSuggestions: () => Promise<void>
  suggestionReasoning: string | null

  // Story generation
  generatedStory: GeneratedStory | null
  isGenerating: boolean
  generationError: string | null
  generateStory: () => Promise<void>

  // Illustration generation
  illustrationUrls: Record<string, string> // key: "page-{pageNum}-panel-{panelIdx}", value: URL
  isGeneratingIllustrations: boolean
  illustrationProgress: { completed: number; total: number }
  illustrationError: string | null
  generateIllustrations: () => Promise<void>
  regenerateIllustration: (pageNumber: number, panelIndex: number, prompt: string) => Promise<void>

  // Inline editing & revision
  editingPanel: { pageIndex: number; panelIndex: number } | null
  setEditingPanel: (panel: { pageIndex: number; panelIndex: number } | null) => void
  updatePanelContent: (pageIndex: number, panelIndex: number, content: string) => void
  revisionPrompt: string
  setRevisionPrompt: (prompt: string) => void
  isRevising: boolean
  revisionError: string | null
  reviseStory: () => Promise<void>
  regenerateStory: () => Promise<void>
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

function validateImageFile(file: File): string | null {
  if (!file.type.startsWith('image/')) {
    return 'Please upload an image file (JPEG, PNG, GIF, etc.)'
  }
  const maxSize = 5 * 1024 * 1024 // 5MB
  if (file.size > maxSize) {
    return `Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Please use an image under 5 MB.`
  }
  return null
}

export function useStorybookFactoryState(): StorybookFactoryState {
  const [image1Base64, setImage1Base64] = useState<string | null>(null)
  const [image2Base64, setImage2Base64] = useState<string | null>(null)
  const [caption1, setCaption1State] = useState('')
  const [caption2, setCaption2State] = useState('')
  const [storyDirectionPrompt, setStoryDirectionPromptState] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Story configuration state
  const [storyConfig, setStoryConfigState] = useState<StoryConfiguration>(DEFAULT_STORY_CONFIG)
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false)
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null)
  const [suggestionReasoning, setSuggestionReasoning] = useState<string | null>(null)

  // Story generation state
  const [generatedStory, setGeneratedStory] = useState<GeneratedStory | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)

  // Illustration generation state
  const [illustrationUrls, setIllustrationUrls] = useState<Record<string, string>>({})
  const [isGeneratingIllustrations, setIsGeneratingIllustrations] = useState(false)
  const [illustrationProgress, setIllustrationProgress] = useState({ completed: 0, total: 0 })
  const [illustrationError, setIllustrationError] = useState<string | null>(null)

  // Inline editing & revision state
  const [editingPanel, setEditingPanel] = useState<{ pageIndex: number; panelIndex: number } | null>(null)
  const [revisionPrompt, setRevisionPromptState] = useState('')
  const [isRevising, setIsRevising] = useState(false)
  const [revisionError, setRevisionError] = useState<string | null>(null)

  const setImage1 = (file: File) => {
    const validationError = validateImageFile(file)
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    setIsLoading(true)
    fileToBase64(file)
      .then(base64 => {
        setImage1Base64(base64)
      })
      .catch(() => {
        setError('Failed to read image. Please try again.')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  const setImage2 = (file: File) => {
    const validationError = validateImageFile(file)
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    setIsLoading(true)
    fileToBase64(file)
      .then(base64 => {
        setImage2Base64(base64)
      })
      .catch(() => {
        setError('Failed to read image. Please try again.')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  const clearImage1 = () => {
    setImage1Base64(null)
    setCaption1State('')
  }

  const clearImage2 = () => {
    setImage2Base64(null)
    setCaption2State('')
  }

  const setStoryConfig = (updates: Partial<StoryConfiguration>) => {
    setStoryConfigState(prev => ({ ...prev, ...updates }))
  }

  const fetchSuggestions = async () => {
    setIsSuggestionsLoading(true)
    setSuggestionsError(null)
    try {
      const response = await fetch('/api/v1/storybook-factory/suggest-configuration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption1,
          caption2,
          storyDirectionPrompt,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch suggestions')
      }

      const data = await response.json()

      // Merge suggestions into config (graceful: only update known fields)
      const updates: Partial<StoryConfiguration> = {}
      if (data.storyType) updates.storyType = data.storyType
      if (data.artStyle) updates.artStyle = data.artStyle
      if (data.pageCount) updates.pageCount = data.pageCount
      if (data.tone) updates.tone = data.tone
      if (data.panelsPerPage) updates.panelsPerPage = data.panelsPerPage
      if (data.dialogueStyle) updates.dialogueStyle = data.dialogueStyle
      setStoryConfigState(prev => ({ ...prev, ...updates }))

      if (data.reasoning) {
        setSuggestionReasoning(data.reasoning)
      }
    } catch {
      // Graceful degradation: keep defaults, show no error to avoid blocking the user
      setSuggestionsError('Could not load AI suggestions. Using defaults — feel free to customize.')
    } finally {
      setIsSuggestionsLoading(false)
    }
  }

  const generateStory = async () => {
    setIsGenerating(true)
    setGenerationError(null)
    try {
      const response = await fetch('/api/v1/storybook-factory/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption1,
          caption2,
          storyDirectionPrompt,
          storyConfig,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate story')
      }

      const data = await response.json()
      setGeneratedStory({
        layout: data.layout,
        generatedAt: data.generatedAt,
      })
    } catch {
      setGenerationError('Something went wrong generating your story. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const generateIllustrations = async () => {
    if (!generatedStory) return

    const illustrationPanels: Array<{ key: string; prompt: string }> = []
    for (const page of generatedStory.layout.pages) {
      page.panels.forEach((panel, panelIdx) => {
        if (panel.type === 'illustration') {
          illustrationPanels.push({
            key: `page-${page.pageNumber}-panel-${panelIdx}`,
            prompt: panel.content,
          })
        }
      })
    }

    if (illustrationPanels.length === 0) return

    setIsGeneratingIllustrations(true)
    setIllustrationError(null)
    setIllustrationProgress({ completed: 0, total: illustrationPanels.length })

    const storyContext = `A ${generatedStory.layout.type} story called "${generatedStory.layout.title}"`

    for (const { key, prompt } of illustrationPanels) {
      try {
        const response = await fetch('/api/v1/storybook-factory/generate-illustration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            artStyle: storyConfig.artStyle,
            storyContext,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          setIllustrationUrls(prev => ({ ...prev, [key]: data.imageUrl }))
        } else {
          console.error(`Failed to generate illustration for ${key}: HTTP ${response.status}`)
        }
      } catch (err) {
        console.error(`Failed to generate illustration for ${key}:`, err)
        // Continue with remaining panels even on individual failure
      }

      setIllustrationProgress(prev => ({ ...prev, completed: prev.completed + 1 }))
    }

    setIsGeneratingIllustrations(false)
  }

  const updatePanelContent = (pageIndex: number, panelIndex: number, content: string) => {
    setGeneratedStory(prev => {
      if (!prev) return prev
      const newLayout = JSON.parse(JSON.stringify(prev.layout)) // deep copy
      if (newLayout.pages[pageIndex]?.panels[panelIndex]) {
        newLayout.pages[pageIndex].panels[panelIndex].content = content
      }
      return { ...prev, layout: newLayout }
    })
  }

  const reviseStory = async () => {
    if (!generatedStory || !revisionPrompt.trim()) return
    setIsRevising(true)
    setRevisionError(null)
    try {
      const response = await fetch('/api/v1/storybook-factory/revise-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          revisionPrompt: revisionPrompt.trim(),
          currentLayout: generatedStory.layout,
          storyConfig,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to revise story')
      }

      const data = await response.json()
      setGeneratedStory({
        layout: data.layout,
        generatedAt: data.generatedAt,
      })
      setRevisionPromptState('')
    } catch {
      setRevisionError('Something went wrong revising your story. Please try again.')
    } finally {
      setIsRevising(false)
    }
  }

  const regenerateStory = async () => {
    setGeneratedStory(null)
    setIllustrationUrls({})
    await generateStory()
  }

  const regenerateIllustration = async (pageNumber: number, panelIndex: number, prompt: string) => {
    const key = `page-${pageNumber}-panel-${panelIndex}`
    const storyContext = generatedStory
      ? `A ${generatedStory.layout.type} story called "${generatedStory.layout.title}"`
      : ''
    try {
      const response = await fetch('/api/v1/storybook-factory/generate-illustration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          artStyle: storyConfig.artStyle,
          storyContext,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        setIllustrationUrls(prev => ({ ...prev, [key]: data.imageUrl }))
      } else {
        console.error(`Failed to regenerate illustration for ${key}: HTTP ${response.status}`)
        setIllustrationError('Failed to regenerate illustration. Please try again.')
      }
    } catch (err) {
      console.error(`Failed to regenerate illustration for ${key}:`, err)
      setIllustrationError('Failed to regenerate illustration. Please try again.')
    }
  }

  const canProceedFromUpload = image1Base64 !== null && image2Base64 !== null

  return {
    image1Base64,
    image2Base64,
    caption1,
    caption2,
    storyDirectionPrompt,
    isLoading,
    error,
    setImage1,
    setImage2,
    clearImage1,
    clearImage2,
    setCaption1: setCaption1State,
    setCaption2: setCaption2State,
    setStoryDirectionPrompt: setStoryDirectionPromptState,
    clearError: () => setError(null),
    canProceedFromUpload,
    storyConfig,
    setStoryConfig,
    isSuggestionsLoading,
    suggestionsError,
    fetchSuggestions,
    suggestionReasoning,
    generatedStory,
    isGenerating,
    generationError,
    generateStory,
    illustrationUrls,
    isGeneratingIllustrations,
    illustrationProgress,
    illustrationError,
    generateIllustrations,
    regenerateIllustration,
    editingPanel,
    setEditingPanel,
    updatePanelContent,
    revisionPrompt,
    setRevisionPrompt: setRevisionPromptState,
    isRevising,
    revisionError,
    reviseStory,
    regenerateStory,
  }
}
