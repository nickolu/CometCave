'use client';

import { Button } from '@/app/voters/components/ui/button';
import type { GameState } from '../page';

interface SecretWordEndProps {
  gameState: GameState;
  onRestart: () => void;
}

export function SecretWordEnd({ gameState, onRestart }: SecretWordEndProps) {
  const winner = gameState.winner ? gameState.players[gameState.winner] : null;

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
          </div>
        )}
      </div>

      {/* Game Summary */}
      <div className="bg-space-dark/50 border border-space-purple/30 rounded-lg p-6 max-w-2xl mx-auto">
        <h3 className="text-xl font-semibold text-cream-white mb-4">Game Summary</h3>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="bg-space-blue/20 border border-space-blue/30 rounded-lg p-4">
            <h4 className="font-semibold text-cream-white mb-2">
              {gameState.players.player1.name}
            </h4>
            <p className="text-slate-300 text-sm">
              Secret word:{' '}
              <span className="font-mono bg-slate-800 px-2 py-1 rounded text-cream-white">
                {gameState.players.player1.secretWord}
              </span>
            </p>
            <p className="text-xs text-slate-400 mt-2">
              {gameState.winner === 'player1' ? '🏆 Winner' : '😔 Lost'}
            </p>
          </div>

          <div className="bg-space-purple/20 border border-space-purple/30 rounded-lg p-4">
            <h4 className="font-semibold text-cream-white mb-2">
              {gameState.players.player2.name}
            </h4>
            <p className="text-slate-300 text-sm">
              Secret word:{' '}
              <span className="font-mono bg-slate-800 px-2 py-1 rounded text-cream-white">
                {gameState.players.player2.secretWord}
              </span>
            </p>
            <p className="text-xs text-slate-400 mt-2">
              {gameState.winner === 'player2' ? '🏆 Winner' : '😔 Lost'}
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
              const player = gameState.players[message.playerId];
              const isPlayer1 = message.playerId === 'player1';

              return (
                <div
                  key={message.id}
                  className={`text-sm p-2 rounded ${
                    isPlayer1
                      ? 'bg-space-blue/20 border-l-2 border-space-blue'
                      : 'bg-space-purple/20 border-l-2 border-space-purple'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span
                      className={`font-medium ${isPlayer1 ? 'text-space-blue' : 'text-space-purple'}`}
                    >
                      {player.name}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(message.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-cream-white">{message.content}</p>
                </div>
              );
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
  );
}
