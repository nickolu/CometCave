'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/app/voters/components/ui/button';
import { Input } from '@/app/voters/components/ui/input';
import type { GameState, Message } from '../page';

interface SecretWordChatProps {
  gameState: GameState;
  onSendMessage: (content: string, isQuestion?: boolean) => void;
}

export function SecretWordChat({ gameState, onSendMessage }: SecretWordChatProps) {
  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentPlayer = gameState.players[gameState.currentTurn];
  const otherPlayer =
    gameState.players[gameState.currentTurn === 'player1' ? 'player2' : 'player1'];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState.messages]);

  const handleSend = () => {
    if (messageInput.trim()) {
      onSendMessage(messageInput.trim());
      setMessageInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      {/* Game Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-cream-white mb-2">Secret Word Game</h2>
        <div className="flex justify-center items-center gap-8 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Playing:</span>
            <span className="text-space-blue font-medium">{gameState.players.player1.name}</span>
            <span className="text-slate-500">vs</span>
            <span className="text-space-purple font-medium">{gameState.players.player2.name}</span>
          </div>
        </div>
      </div>

      {/* Current Turn Indicator */}
      <div className="bg-space-purple/20 border border-space-purple/30 rounded-lg p-4 text-center">
        <p className="text-cream-white">
          <span className="font-semibold text-space-purple">{currentPlayer.name}</span>'s turn to
          speak
        </p>
        <p className="text-slate-400 text-sm mt-1">
          Remember: Don't say your secret word or you'll lose!
        </p>
      </div>

      {/* Messages */}
      <div className="bg-slate-900/50 rounded-lg p-4 h-96 overflow-y-auto border border-slate-700">
        <div className="space-y-4">
          {gameState.messages.length === 0 ? (
            <div className="text-center text-slate-400 py-8">
              <p>
                Game started! {gameState.players.player1.name} can ask the first question or make a
                statement.
              </p>
            </div>
          ) : (
            gameState.messages.map(message => (
              <MessageBubble key={message.id} message={message} gameState={gameState} />
            ))
          )}
          <div ref={messagesEndRef} />
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
            className="bg-slate-800 border-slate-700 text-cream-white flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!messageInput.trim()}
            className="bg-space-purple text-cream-white hover:bg-space-purple/90"
          >
            Send
          </Button>
        </div>

        <div className="text-center text-slate-400 text-sm">
          <p>
            Tips: Ask questions to learn about your opponent's word, but be careful not to say your
            own word!
          </p>
        </div>
      </div>

      {/* Game Info */}
      <div className="grid md:grid-cols-2 gap-4 text-sm">
        <div className="bg-space-blue/20 border border-space-blue/30 rounded-lg p-4">
          <h4 className="font-semibold text-cream-white mb-2">{gameState.players.player1.name}</h4>
          <p className="text-slate-300">
            Your secret word: <span className="font-mono bg-slate-800 px-2 py-1 rounded">***</span>
          </p>
        </div>

        <div className="bg-space-purple/20 border border-space-purple/30 rounded-lg p-4">
          <h4 className="font-semibold text-cream-white mb-2">{gameState.players.player2.name}</h4>
          <p className="text-slate-300">
            Your secret word: <span className="font-mono bg-slate-800 px-2 py-1 rounded">***</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, gameState }: { message: Message; gameState: GameState }) {
  const player = gameState.players[message.playerId];
  const isPlayer1 = message.playerId === 'player1';

  return (
    <div className={`flex ${isPlayer1 ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
          isPlayer1
            ? 'bg-space-blue/30 border border-space-blue/50'
            : 'bg-space-purple/30 border border-space-purple/50'
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`text-sm font-medium ${isPlayer1 ? 'text-space-blue' : 'text-space-purple'}`}
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
        <p className="text-cream-white text-sm">{message.content}</p>
      </div>
    </div>
  );
}
