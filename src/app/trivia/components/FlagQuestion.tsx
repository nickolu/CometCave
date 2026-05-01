'use client'
import { useState } from 'react'

import { ChunkyButton } from '@/components/ui/chunky-button'
import { useAuth } from '@/hooks/useAuth'

const FLAG_REASONS = [
  { value: 'obvious', label: 'Answer is included in the question / too obvious' },
  { value: 'unanswerable', label: "Question doesn't have one right answer or is impossible to answer" },
  { value: 'nonsense', label: "Question doesn't make sense" },
  { value: 'inaccurate', label: 'Inaccurate or incorrect' },
  { value: 'difficulty_mismatch', label: "Difficulty doesn't match the challenge" },
  { value: 'other', label: 'Other' },
] as const

interface FlagResult {
  bonusLifeGranted: boolean
}

interface Props {
  questionId: string
  runId?: string | null
  onFlagged?: (result: FlagResult) => void
}

export function FlagQuestion({ questionId, runId, onFlagged }: Props) {
  const { user } = useAuth()
  const [showModal, setShowModal] = useState(false)
  const [reason, setReason] = useState<string>('')
  const [note, setNote] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  if (!user) return null

  const noteRequired = reason === 'other'
  const trimmedNote = note.trim()
  const canSubmit = !!reason && (!noteRequired || trimmedNote.length > 0) && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const token = await user.getIdToken()
      const res = await fetch(`/api/v1/trivia/questions/${questionId}/flag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason, note: trimmedNote || undefined, runId: runId ?? undefined }),
      })
      if (!res.ok) {
        // Surface the failure instead of silently showing "Reported".
        // The user keeps the modal open and can retry.
        let detail = `${res.status}`
        try {
          const errBody = (await res.json()) as { error?: string }
          if (errBody?.error) detail = errBody.error
        } catch {
          // fall through with the status code
        }
        setSubmitError(`Couldn't send report (${detail}). Try again.`)
        return
      }
      setSubmitted(true)
      setShowModal(false)
      if (onFlagged) {
        let result: FlagResult = { bonusLifeGranted: false }
        try {
          const data = await res.json()
          result = { bonusLifeGranted: data.bonusLifeGranted ?? false }
        } catch {
          // use defaults
        }
        onFlagged(result)
      }
    } catch (err) {
      setSubmitError(`Couldn't send report (${err instanceof Error ? err.message : 'network error'}). Try again.`)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) return <span className="text-on-surface/30 text-xs">Reported</span>

  return (
    <>
      <button onClick={() => setShowModal(true)} className="text-on-surface/20 hover:text-ds-error/60 text-xs transition-colors" aria-label="Flag for Removal/Deletion" title="Flag for Removal/Deletion">
        🚩
      </button>
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-dim/80 backdrop-blur-sm">
          <div className="bg-surface-container-high rounded-ds-lg p-6 max-w-sm mx-4 shadow-hero flex flex-col gap-4">
            <h3 className="text-on-surface font-bold text-lg">Report Question</h3>
            <div className="flex flex-col gap-2">
              {FLAG_REASONS.map(r => (
                <label key={r.value} className="flex items-center gap-2 text-on-surface/80 text-sm cursor-pointer">
                  <input type="radio" name="flag-reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="accent-ds-tertiary" />
                  {r.label}
                </label>
              ))}
            </div>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value.slice(0, 500))}
              placeholder={noteRequired ? 'Tell us more (required)...' : 'Add context (optional)...'}
              maxLength={500}
              className="bg-surface-container-highest border border-outline-variant rounded-lg p-2 text-on-surface text-sm resize-none h-20 placeholder:text-on-surface/40"
            />
            {submitError && (
              <p className="text-ds-error text-xs">{submitError}</p>
            )}
            <div className="flex gap-3 justify-end">
              <ChunkyButton variant="secondary" size="sm" onClick={() => setShowModal(false)}>Cancel</ChunkyButton>
              <ChunkyButton variant="exit" size="sm" disabled={!canSubmit} onClick={handleSubmit}>
                {submitting ? 'Sending...' : 'Report'}
              </ChunkyButton>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
