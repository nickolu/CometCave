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
    if (vote !== null) return // terminal — one vote per question per session
    setVote(newVote)
    try {
      const token = await user.getIdToken()
      const res = await fetch(`/api/v1/trivia/questions/${questionId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ vote: newVote }),
      })
      if (!res.ok) setVote(null) // rollback
    } catch {
      setVote(null) // rollback
    }
  }

  if (vote === 'up') {
    return <span className="text-on-surface/40 text-xs">👍 Liked</span>
  }
  if (vote === 'down') {
    return <span className="text-on-surface/40 text-xs">👎 Disliked</span>
  }

  return (
    <div className="flex items-center gap-1">
      <button onClick={() => handleVote('up')} className="text-sm p-0.5 rounded text-on-surface/30 hover:text-on-surface/60 transition-colors" aria-label="Good Question" title="Good Question">
        👍
      </button>
      <button onClick={() => handleVote('down')} className="text-sm p-0.5 rounded text-on-surface/30 hover:text-on-surface/60 transition-colors" aria-label="Bad Question" title="Bad Question">
        👎
      </button>
    </div>
  )
}
