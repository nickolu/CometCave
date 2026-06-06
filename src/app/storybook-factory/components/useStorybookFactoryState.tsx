'use client'

import { useState } from 'react'

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
  }
}
