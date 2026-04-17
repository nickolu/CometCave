'use client'

import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface NamePromptProps {
  onSave: (name: string) => void
  onSkip?: () => void
  title?: string
  description?: string
  showSkip?: boolean
  initialName?: string
}

export function NamePrompt({
  onSave,
  onSkip,
  title = 'Enter a display name',
  description = 'Your name will appear on the leaderboard',
  showSkip = true,
  initialName = '',
}: NamePromptProps) {
  const [name, setName] = useState(initialName)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSave = () => {
    const trimmed = name.trim()
    if (trimmed.length > 0) {
      onSave(trimmed)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave()
    }
  }

  return (
    <Card className="w-full bg-space-dark/80 border-space-grey">
      <CardContent className="pt-6 flex flex-col gap-4">
        <div className="text-center">
          <h3 className="text-lg font-bold text-cream-white">{title}</h3>
          <p className="text-cream-white/60 text-sm mt-1">{description}</p>
        </div>
        <Input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 20))}
          placeholder="Your display name"
          className="bg-space-black/50 border-space-grey text-cream-white placeholder:text-cream-white/30"
          onKeyDown={handleKeyDown}
          maxLength={20}
        />
        <Button
          variant="space"
          onClick={handleSave}
          disabled={name.trim().length === 0}
          className="w-full"
        >
          Save
        </Button>
        {showSkip && onSkip && (
          <button
            onClick={onSkip}
            className="text-cream-white/40 text-sm text-center hover:text-cream-white/60 transition-colors"
          >
            Skip for now
          </button>
        )}
      </CardContent>
    </Card>
  )
}
