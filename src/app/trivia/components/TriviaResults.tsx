'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { TriviaGameResult } from '../models/trivia'

export function TriviaResults({ result, onBack }: { result: TriviaGameResult; onBack: () => void }) {
  const percentage = result.total > 0 ? Math.round((result.correct / result.total) * 100) : 0

  const getMessage = () => {
    if (percentage === 100) return 'Perfect score! 🌟'
    if (percentage >= 80) return 'Outstanding! 🎉'
    if (percentage >= 60) return 'Well done! 👏'
    if (percentage >= 40) return 'Not bad! 🙂'
    return 'Better luck tomorrow! 💪'
  }

  return (
    <div className="flex flex-col items-center gap-6 max-w-lg mx-auto py-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-space-gold mb-2">Game Over!</h2>
        <p className="text-cream-white/70 text-lg">{getMessage()}</p>
      </div>

      <Card className="w-full bg-space-dark/80 border-space-grey">
        <CardContent className="pt-6">
          <div className="text-center mb-4">
            <div className="text-5xl font-bold text-space-gold">{result.score}</div>
            <div className="text-cream-white/60 text-sm">Total Points</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-cream-white">
                {result.correct}/{result.total}
              </div>
              <div className="text-cream-white/60 text-sm">Correct</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-cream-white">{percentage}%</div>
              <div className="text-cream-white/60 text-sm">Accuracy</div>
            </div>
          </div>

          {/* Answer breakdown */}
          <div className="mt-4 flex gap-1.5 justify-center">
            {result.answers.map((a, i) => (
              <div
                key={i}
                className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold ${
                  a.correct
                    ? 'bg-green-600/30 text-green-400'
                    : 'bg-red-600/30 text-red-400'
                }`}
              >
                {i + 1}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button variant="outline" onClick={onBack} className="w-full">
        Back to Trivia
      </Button>
    </div>
  )
}
