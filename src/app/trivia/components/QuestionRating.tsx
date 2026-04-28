'use client'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

interface Props {
  questionId: string
}

export function QuestionRating({ questionId }: Props) {
  const { user } = useAuth()
  const [vote, setVote] = useState<'up' | 'down' | null>(null)

  if (!user) return null  // logged-in only

  const handleVote = async (newVote: 'up' | 'down') => {
    const prev = vote
    setVote(newVote === vote ? null : newVote)  // toggle
    try {
      const token = await user.getIdToken()
      const res = await fetch(`/api/v1/trivia/questions/${questionId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ vote: newVote === vote ? null : newVote }),
      })
      if (!res.ok) setVote(prev) // rollback
    } catch {
      setVote(prev) // rollback
    }
  }

  return (
    <div className="flex items-center gap-1">
      <button onClick={() => handleVote('up')} className={`text-sm p-0.5 rounded transition-colors ${vote === 'up' ? 'text-ds-primary' : 'text-on-surface/30 hover:text-on-surface/60'}`} aria-label="Rate up">
        👍
      </button>
      <button onClick={() => handleVote('down')} className={`text-sm p-0.5 rounded transition-colors ${vote === 'down' ? 'text-ds-error' : 'text-on-surface/30 hover:text-on-surface/60'}`} aria-label="Rate down">
        👎
      </button>
    </div>
  )
}
