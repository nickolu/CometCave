'use client'

import { Button } from '@/components/ui/button'
import type { GameState } from '../page'

interface SecretWordEndProps {
  gameState: GameState
  onRestart: () => void
}

// Scoring calculation function
function calculateFinalScore(gameState: GameState): number | null {
  // Only calculate score if player won
  if (gameState.winner !== 'player' || !gameState.players.player.wordScore) {
    return null
  }

  const baseScore = gameState.players.player.wordScore
  const messageCount = gameState.messages.length
  const gameDurationMinutes =
    gameState.messages.length > 0
      ? Math.round(
          (gameState.messages[gameState.messages.length - 1].timestamp -
            gameState.messages[0].timestamp) /
            1000 /
            60
        )
      : 0

  // Bonus calculations (shorter/fewer is better)
  // Message bonus: fewer messages = higher bonus (max 50 bonus points)
  const messageBonus = Math.max(0, 50 - Math.floor(messageCount / 2))

  // Time bonus: shorter time = higher bonus (max 30 bonus points)
  // Bonus decreases by 5 points per minute after the first minute
  const timeBonus = Math.max(0, 30 - Math.max(0, gameDurationMinutes - 1) * 5)

  const finalScore = baseScore + messageBonus + timeBonus

  return Math.max(finalScore, baseScore) // Ensure score is never less than base word score
}

function getScoreBreakdown(gameState: GameState) {
  if (gameState.winner !== 'player' || !gameState.players.player.wordScore) {
    return null
  }

  const baseScore = gameState.players.player.wordScore
  const messageCount = gameState.messages.length
  const gameDurationMinutes =
    gameState.messages.length > 0
      ? Math.round(
          (gameState.messages[gameState.messages.length - 1].timestamp -
            gameState.messages[0].timestamp) /
            1000 /
            60
        )
      : 0

  const messageBonus = Math.max(0, 50 - Math.floor(messageCount / 2))
  const timeBonus = Math.max(0, 30 - Math.max(0, gameDurationMinutes - 1) * 5)

  return {
    baseScore,
    messageBonus,
    timeBonus,
    messageCount,
    gameDurationMinutes,
  }
}

export function SecretWordEnd({ gameState, onRestart }: SecretWordEndProps) {
  const winner = gameState.winner ? gameState.players[gameState.winner] : null
  const finalScore = calculateFinalScore(gameState)
  const scoreBreakdown = getScoreBreakdown(gameState)

  return (
    <div className="space-y-8 text-center">
      {/* Winner Announcement */}
      <div className="space-y-4">
        <div className="text-6xl mb-4">{winner ? '🎉' : '🤔'}</div>

        <h2 className="text-4xl font-bold text-cream-white mb-2">
          {winner ? 'Game Over!' : 'Something went wrong!'}
        </h2>

        {winner && (
          <div className="space-y-2">
            <p className="text-2xl text-space-purple font-semibold">{winner.name} Wins!</p>
            <p className="text-slate-400 max-w-2xl mx-auto">{gameState.winReason}</p>

            {/* Final Score Display */}
            {finalScore !== null && (
              <div className="bg-green-600/20 border border-green-500/30 rounded-lg p-4 max-w-md mx-auto mt-4">
                <h3 className="text-2xl font-bold text-green-400 mb-2">Final Score</h3>
                <div className="text-4xl font-bold text-green-300 mb-3">{finalScore}</div>

                {scoreBreakdown && (
                  <div className="text-sm text-slate-300 space-y-1">
                    <div className="flex justify-between">
                      <span>Word difficulty:</span>
                      <span className="text-green-400">+{scoreBreakdown.baseScore}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Efficiency bonus ({scoreBreakdown.messageCount} messages):</span>
                      <span className="text-green-400">+{scoreBreakdown.messageBonus}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Speed bonus ({scoreBreakdown.gameDurationMinutes}m):</span>
                      <span className="text-green-400">+{scoreBreakdown.timeBonus}</span>
                    </div>
                    <div className="border-t border-slate-600 pt-1 mt-2 flex justify-between font-semibold">
                      <span>Total:</span>
                      <span className="text-green-400">{finalScore}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Game Summary */}
      <div className="bg-space-dark/50 border border-space-purple/30 rounded-lg p-6 max-w-2xl mx-auto">
        <h3 className="text-xl font-semibold text-cream-white mb-4">Game Summary</h3>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="bg-space-blue/20 border border-space-blue/30 rounded-lg p-4">
            <h4 className="font-semibold text-cream-white mb-2">{gameState.players.player.name}</h4>
            <p className="text-slate-300 text-sm">
              Secret word:{' '}
              <span className="font-mono bg-slate-800 px-2 py-1 rounded text-cream-white">
                {gameState.players.player.secretWord}
              </span>
            </p>
            {gameState.players.player.wordScore && (
              <p className="text-slate-300 text-sm mt-1">
                Word difficulty:{' '}
                <span className="text-yellow-400">{gameState.players.player.wordScore} pts</span>
              </p>
            )}
            <p className="text-xs text-slate-400 mt-2">
              {gameState.winner === 'player' ? '🏆 Winner' : '😔 Lost'}
            </p>
          </div>

          <div className="bg-space-purple/20 border border-space-purple/30 rounded-lg p-4">
            <h4 className="font-semibold text-cream-white mb-2">{gameState.players.ai.name}</h4>
            <p className="text-slate-300 text-sm">
              Secret word:{' '}
              <span className="font-mono bg-slate-800 px-2 py-1 rounded text-cream-white">
                {gameState.players.ai.secretWord}
              </span>
            </p>
            <p className="text-xs text-slate-400 mt-2">
              {gameState.winner === 'ai' ? '🏆 Winner' : '😔 Lost'}
            </p>
          </div>
        </div>

        <div className="space-y-2 text-sm text-slate-400">
          <p>Total messages exchanged: {gameState.messages.length}</p>
          <p>
            Game duration:{' '}
            {gameState.messages.length > 0
              ? Math.round(
                  (gameState.messages[gameState.messages.length - 1].timestamp -
                    gameState.messages[0].timestamp) /
                    1000 /
                    60
                )
              : 0}{' '}
            minutes
          </p>
        </div>
      </div>

      {/* Message History */}
      {gameState.messages.length > 0 && (
        <div className="bg-space-dark/30 border border-slate-700 rounded-lg p-4 max-w-2xl mx-auto">
          <h4 className="font-semibold text-cream-white mb-4">Message History</h4>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {gameState.messages.map(message => {
              const player = gameState.players[message.playerId]
              const isPlayer = message.playerId === 'player'

              return (
                <div
                  key={message.id}
                  className={`text-sm p-2 rounded ${
                    isPlayer
                      ? 'bg-space-blue/20 border-l-2 border-space-blue'
                      : 'bg-space-purple/20 border-l-2 border-space-purple'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className={`font-medium ${isPlayer ? 'text-white' : 'text-gray-400'}`}>
                      {player.name}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(message.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-cream-white text-left">{message.content}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-center gap-4">
        <Button
          onClick={onRestart}
          className="bg-space-purple text-cream-white hover:bg-space-purple/90 px-8"
        >
          Play Again
        </Button>

        <Button
          onClick={() => (window.location.href = '/')}
          variant="outline"
          className="bg-transparent text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-cream-white px-8"
        >
          Back to Home
        </Button>
      </div>

      {/* Fun Facts */}
      <div className="bg-space-purple/10 border border-space-purple/20 rounded-lg p-4 max-w-xl mx-auto">
        <h4 className="font-semibold text-cream-white mb-2">Did you know?</h4>
        <p className="text-slate-400 text-sm">
          The Secret Word game is also known as &quot;Taboo&quot; and is great for improving
          vocabulary and strategic thinking. The key is to ask clever questions while avoiding your
          own forbidden word!
        </p>
      </div>
    </div>
  )
}
