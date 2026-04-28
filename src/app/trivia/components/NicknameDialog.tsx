'use client'

import { useEffect, useRef, useState } from 'react'

import { NICKNAME_MAX_LENGTH, sanitizeNickname } from '@/app/trivia/hooks/useTriviaUser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface NicknameDialogProps {
  initialValue: string
  onClose: () => void
  onSave: (nickname: string) => Promise<void>
}

export function NicknameDialog({ initialValue, onClose, onSave }: NicknameDialogProps) {
  const [value, setValue] = useState(initialValue)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const trimmedLength = value.trim().length
  const canSave = trimmedLength > 0 && !saving

  const handleSave = async () => {
    const clean = sanitizeNickname(value)
    if (!clean) {
      setError('Nickname cannot be empty.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(clean)
      onClose()
    } catch (err) {
      console.error('Failed to save nickname:', err)
      setError('Could not save nickname. Try again.')
      setSaving(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="nickname-dialog-title"
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-space-grey bg-space-dark p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="nickname-dialog-title"
          className="text-lg font-bold text-space-gold mb-1"
        >
          Choose your nickname
        </h2>
        <p className="text-cream-white/60 text-sm mb-4">
          Shown on the leaderboard and wherever your name appears.
        </p>
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canSave) {
              e.preventDefault()
              handleSave()
            }
          }}
          maxLength={NICKNAME_MAX_LENGTH}
          placeholder="e.g. Stargazer"
          className="text-cream-white"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-cream-white/40">
            {trimmedLength}/{NICKNAME_MAX_LENGTH}
          </span>
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="space" onClick={handleSave} disabled={!canSave}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}
