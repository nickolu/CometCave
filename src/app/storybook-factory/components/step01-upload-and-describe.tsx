'use client'

import { useRef, useState } from 'react'

import { ChunkyButton } from '@/components/ui/chunky-button'
import { cn } from '@/lib/utils'

interface ImageUploadZoneProps {
  label: string
  imageBase64: string | null
  onImageSelect: (file: File) => void
  onImageRemove: () => void
}

function ImageUploadZone({ label, imageBase64, onImageSelect, onImageRemove }: ImageUploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onImageSelect(file)
      // Reset input so same file can be re-selected after removal
      e.target.value = ''
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      onImageSelect(file)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-body text-body-sm text-on-surface-variant">{label}</p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        aria-label={`Upload ${label}`}
      />

      {imageBase64 ? (
        <div className="relative rounded-2xl overflow-hidden bg-surface-container-high border border-outline-variant">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageBase64}
            alt={`Preview for ${label}`}
            className="w-full max-h-64 object-contain"
          />
          <button
            type="button"
            onClick={onImageRemove}
            aria-label={`Remove ${label}`}
            className={cn(
              'absolute top-2 right-2 min-w-[48px] min-h-[48px] flex items-center justify-center',
              'rounded-full bg-surface-container/90 border border-outline-variant',
              'text-on-surface hover:bg-error-container hover:text-on-error-container',
              'transition-colors cursor-pointer'
            )}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload image"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              fileInputRef.current?.click()
            }
          }}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'flex flex-col items-center justify-center gap-3 px-6 py-12 rounded-2xl',
            'border-2 border-dashed transition-colors cursor-pointer',
            'min-h-[180px]',
            isDragOver
              ? 'border-primary bg-primary-container/20'
              : 'border-outline-variant hover:border-primary hover:bg-surface-container-high/50'
          )}
        >
          <span
            className="material-symbols-outlined text-[48px] text-on-surface-variant"
            style={{ fontVariationSettings: "'FILL' 0" }}
          >
            add_photo_alternate
          </span>
          <p className="font-body text-body-sm text-on-surface-variant text-center">
            Drop image here or click to upload
          </p>
          <p className="font-body text-body-sm text-on-surface-variant/60 text-center">
            JPEG, PNG, GIF — max 5 MB
          </p>
        </div>
      )}
    </div>
  )
}

export interface Step01Props {
  onNext: () => void
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

export function Step01UploadAndDescribe({
  onNext,
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
  setCaption1,
  setCaption2,
  setStoryDirectionPrompt,
  clearError,
  canProceedFromUpload,
}: Step01Props) {
  return (
    <div className="space-y-6 mt-6">
      {/* Header */}
      <div className="bg-surface-container rounded-2xl p-6 space-y-2">
        <h2 className="font-headline text-2xl text-on-surface">Upload &amp; Describe</h2>
        <p className="font-body text-body-md text-on-surface-variant">
          Upload two images to inspire your story.
        </p>
      </div>

      {/* Upload zones */}
      <div className="bg-surface-container rounded-2xl p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Image 1 */}
          <div className="flex flex-col gap-3">
            <ImageUploadZone
              label="Image 1"
              imageBase64={image1Base64}
              onImageSelect={setImage1}
              onImageRemove={clearImage1}
            />
            <textarea
              value={caption1}
              onChange={e => setCaption1(e.target.value)}
              placeholder="Describe this image (optional)"
              rows={2}
              disabled={!image1Base64}
              className={cn(
                'w-full rounded-xl px-4 py-3 resize-none',
                'bg-surface-container-high border border-outline-variant',
                'font-body text-body-sm text-on-surface placeholder:text-on-surface-variant/60',
                'focus:outline-none focus:border-primary',
                'transition-colors',
                !image1Base64 && 'opacity-40 cursor-not-allowed'
              )}
              aria-label="Caption for image 1"
            />
          </div>

          {/* Image 2 */}
          <div className="flex flex-col gap-3">
            <ImageUploadZone
              label="Image 2"
              imageBase64={image2Base64}
              onImageSelect={setImage2}
              onImageRemove={clearImage2}
            />
            <textarea
              value={caption2}
              onChange={e => setCaption2(e.target.value)}
              placeholder="Describe this image (optional)"
              rows={2}
              disabled={!image2Base64}
              className={cn(
                'w-full rounded-xl px-4 py-3 resize-none',
                'bg-surface-container-high border border-outline-variant',
                'font-body text-body-sm text-on-surface placeholder:text-on-surface-variant/60',
                'focus:outline-none focus:border-primary',
                'transition-colors',
                !image2Base64 && 'opacity-40 cursor-not-allowed'
              )}
              aria-label="Caption for image 2"
            />
          </div>
        </div>

        {/* Story direction prompt */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor="story-direction"
            className="font-body text-body-sm text-on-surface-variant"
          >
            What kind of story should this be? <span className="text-on-surface-variant/60">(optional)</span>
          </label>
          <textarea
            id="story-direction"
            value={storyDirectionPrompt}
            onChange={e => setStoryDirectionPrompt(e.target.value)}
            placeholder="e.g. A cozy adventure about friendship and discovery..."
            rows={3}
            className={cn(
              'w-full rounded-xl px-4 py-3 resize-none',
              'bg-surface-container-high border border-outline-variant',
              'font-body text-body-sm text-on-surface placeholder:text-on-surface-variant/60',
              'focus:outline-none focus:border-primary',
              'transition-colors'
            )}
          />
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 bg-error-container text-on-error-container rounded-2xl px-5 py-4"
        >
          <span className="material-symbols-outlined text-[20px] mt-0.5 shrink-0">error</span>
          <p className="font-body text-body-sm flex-1">{error}</p>
          <button
            type="button"
            onClick={clearError}
            aria-label="Dismiss error"
            className="shrink-0 hover:opacity-70 transition-opacity cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
      )}

      {/* Next button */}
      <div className="flex justify-end">
        <ChunkyButton
          variant="primary"
          onClick={() => {
            if (canProceedFromUpload && !isLoading) onNext()
          }}
          disabled={!canProceedFromUpload || isLoading}
          aria-disabled={!canProceedFromUpload || isLoading}
        >
          {isLoading ? (
            <>
              <span
                className="inline-block h-4 w-4 border-2 border-t-transparent border-on-primary-container rounded-full animate-spin"
                aria-hidden="true"
              />
              Loading...
            </>
          ) : (
            <>
              Next
              <span className="material-symbols-outlined ml-1 text-[18px]">arrow_forward</span>
            </>
          )}
        </ChunkyButton>
      </div>
    </div>
  )
}
