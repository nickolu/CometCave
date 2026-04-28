'use client'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { ChunkyButton } from '@/components/ui/chunky-button'

const FLAG_REASONS = [
  { value: 'wrong_answer', label: 'Wrong answer marked correct' },
  { value: 'ambiguous', label: "Question doesn't have one right answer" },
  { value: 'inappropriate', label: 'Inappropriate / off-brand' },
  { value: 'other', label: 'Other' },
] as const

interface Props {
  questionId: string
}

export function FlagQuestion({ questionId }: Props) {
  const { user } = useAuth()
  const [showModal, setShowModal] = useState(false)
  const [reason, setReason] = useState<string>('')
  const [note, setNote] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (!user) return null

  const handleSubmit = async () => {
    if (!reason || submitting) return
    setSubmitting(true)
    try {
      const token = await user.getIdToken()
      await fetch(`/api/v1/trivia/questions/${questionId}/flag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason, note: note.trim() || undefined }),
      })
      setSubmitted(true)
      setShowModal(false)
    } catch {
      // silent
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) return <span className="text-on-surface/30 text-xs">Reported</span>

  return (
    <>
      <button onClick={() => setShowModal(true)} className="text-on-surface/20 hover:text-ds-error/60 text-xs transition-colors" aria-label="Report question" title="Report this question">
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
            {reason === 'other' && (
              <textarea value={note} onChange={e => setNote(e.target.value.slice(0, 500))} placeholder="Tell us more..." maxLength={500} className="bg-surface-dim/50 border border-outline-variant rounded-lg p-2 text-on-surface text-sm resize-none h-20" />
            )}
            <div className="flex gap-3 justify-end">
              <ChunkyButton variant="secondary" size="sm" onClick={() => setShowModal(false)}>Cancel</ChunkyButton>
              <ChunkyButton variant="exit" size="sm" disabled={!reason || submitting} onClick={handleSubmit}>
                {submitting ? 'Sending...' : 'Report'}
              </ChunkyButton>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
