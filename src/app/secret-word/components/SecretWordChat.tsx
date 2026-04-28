'use client'

import { useEffect, useRef, useState } from 'react'

import type { GameState, Message } from '@/app/secret-word/page'
import { ChunkyButton } from '@/components/ui/chunky-button'
import { Input } from '@/components/ui/input'

interface SecretWordChatProps {
  gameState: GameState
  onSendMessage: (content: string, isQuestion?: boolean) => void | Promise<void>
  isAIThinking?: boolean
  onRevealAIWord: () => void
}

export function SecretWordChat({
  gameState,
  onSendMessage,
  isAIThinking: _isAIThinking = false,
  onRevealAIWord,
}: SecretWordChatProps) {
  const [messageInput, setMessageInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const currentPlayer = gameState.players[gameState.currentTurn]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [gameState.messages])

  const handleSend = () => {
    if (messageInput.trim()) {
      onSendMessage(messageInput.trim())
      setMessageInput('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="space-y-6">
      {/* Game Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-on-surface mb-2">Secret Word Game</h2>
        <div className="flex justify-center items-center gap-8 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-on-surface-variant">Playing:</span>
            <span className="text-space-blue font-medium">{gameState.players.player.name}</span>
            <span className="text-on-surface-variant">vs</span>
            <span className="text-on-surface font-medium">{gameState.players.ai.name}</span>
          </div>
        </div>
      </div>

      {/* Current Turn Indicator */}
      <div className="bg-surface-variant/20 border border-surface-variant/30 rounded-lg p-4 text-center">
        <p className="text-on-surface">
          <span className="font-semibold text-purple-300">{currentPlayer.name}</span>&apos;s turn to
          speak
        </p>
        <p className="text-on-surface-variant text-sm mt-1">
          Remember: If you say <span className="underline">any</span> secret word you lose!
        </p>
      </div>

      {/* Messages */}
      <div className="bg-surface-dim/50 rounded-lg p-4 h-64 overflow-y-auto border border-outline-variant">
        <div className="space-y-4">
          {gameState.messages.length === 0 ? (
            <div className="text-center text-on-surface-variant py-8">
              <p>
                Game started! {gameState.players.player.name} can ask the first question or make a
                statement.
              </p>
            </div>
          ) : (
            gameState.messages.map(message => (
              <MessageBubble key={message.id} message={message} gameState={gameState} />
            ))
          )}
          <div ref={messagesEndRef} />
          {_isAIThinking && <p className="text-center text-on-surface-variant text-sm">AI is thinking</p>}
        </div>
      </div>

      {/* Message Input */}
      <div className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={messageInput}
            onChange={e => setMessageInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`${currentPlayer.name}, type your message...`}
            className="bg-surface-container-highest border-outline-variant text-on-surface flex-1"
          />
          <ChunkyButton
            onClick={handleSend}
            disabled={!messageInput.trim()}
            className="bg-surface-variant text-on-surface hover:bg-surface-variant/90"
          >
            Send
          </ChunkyButton>
        </div>

        <div className="text-center text-on-surface-variant text-sm">
          <p>
            Tips: Ask questions to learn about your opponent&apos;s word, but be careful not to say
            your own word!
          </p>
        </div>
      </div>

      {/* Game Info */}
      <div className="grid md:grid-cols-2 gap-4 text-sm align-start">
        <div className="h-full bg-space-blue/20 border border-space-blue/30 rounded-lg p-4">
          <h4 className="font-semibold text-on-surface mb-2">{gameState.players.player.name}</h4>
          <p className="text-on-surface-variant">
            Your secret word:{' '}
            <span className="font-mono bg-surface-container-highest px-2 py-1 rounded">
              {gameState.players.player.secretWord}
            </span>
          </p>
        </div>
        {/* Reveal AI Word / Forfeit Button */}
        <div className="h-full text-center bg-space-blue/20 border border-space-blue/30 rounded-lg p-4">
          <ChunkyButton
            variant="ghost"
            onClick={onRevealAIWord}
            className="bg-surface-variant text-on-surface hover:bg-surface-variant/90 border-surface-variant"
          >
            Reveal AI&apos;s secret word (I give up)
          </ChunkyButton>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message, gameState }: { message: Message; gameState: GameState }) {
  const player = gameState.players[message.playerId]
  const isPlayer = message.playerId === 'player'

  return (
    <div className={`flex ${isPlayer ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
          isPlayer
            ? 'bg-space-blue/30 border border-space-blue/50'
            : 'bg-surface-variant/30 border border-surface-variant/50'
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-sm font-medium ${isPlayer ? 'text-blue-300' : 'text-purple-300'}`}>
            {player.name}
          </span>
          <span className="text-xs text-on-surface-variant">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
        <p className="text-on-surface text-sm">{message.content}</p>
      </div>
    </div>
  )
}
