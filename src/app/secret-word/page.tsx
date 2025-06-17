'use client';

import { useState } from 'react';
import { SecretWordSetup } from '@/app/secret-word/components/SecretWordSetup';
import { SecretWordChat } from '@/app/secret-word/components/SecretWordChat';
import { SecretWordEnd } from '@/app/secret-word/components/SecretWordEnd';

type GamePhase = 'setup' | 'playing' | 'ended';

export interface Player {
  id: 'player1' | 'player2';
  name: string;
  secretWord: string;
}

export interface Message {
  id: string;
  playerId: 'player1' | 'player2';
  content: string;
  timestamp: number;
  isQuestion?: boolean;
}

export interface GameState {
  players: {
    player1: Player;
    player2: Player;
  };
  currentTurn: 'player1' | 'player2';
  messages: Message[];
  winner?: 'player1' | 'player2';
  winReason?: string;
  gamePhase: GamePhase;
}

const INITIAL_GAME_STATE: GameState = {
  players: {
    player1: { id: 'player1', name: 'Player 1', secretWord: '' },
    player2: { id: 'player2', name: 'Player 2', secretWord: '' },
  },
  currentTurn: 'player1',
  messages: [],
  gamePhase: 'setup',
};

export default function SecretWordGame() {
  const [gameState, setGameState] = useState<GameState>(INITIAL_GAME_STATE);

  // Check for forbidden words in messages
  const checkForForbiddenWords = (message: string, playerId: 'player1' | 'player2') => {
    const lowerMessage = message.toLowerCase();
    const player1Word = gameState.players.player1.secretWord.toLowerCase();
    const player2Word = gameState.players.player2.secretWord.toLowerCase();

    // Check if player said their own word
    if (playerId === 'player1' && lowerMessage.includes(player1Word)) {
      return {
        hasViolation: true,
        winner: 'player2',
        reason: `${gameState.players.player1.name} said their own word: "${gameState.players.player1.secretWord}"`,
      };
    }
    if (playerId === 'player2' && lowerMessage.includes(player2Word)) {
      return {
        hasViolation: true,
        winner: 'player1',
        reason: `${gameState.players.player2.name} said their own word: "${gameState.players.player2.secretWord}"`,
      };
    }

    // Check if player said opponent's word
    if (playerId === 'player1' && lowerMessage.includes(player2Word)) {
      return {
        hasViolation: true,
        winner: 'player1',
        reason: `${gameState.players.player1.name} guessed the opponent's word: "${gameState.players.player2.secretWord}"`,
      };
    }
    if (playerId === 'player2' && lowerMessage.includes(player1Word)) {
      return {
        hasViolation: true,
        winner: 'player2',
        reason: `${gameState.players.player2.name} guessed the opponent's word: "${gameState.players.player1.secretWord}"`,
      };
    }

    return { hasViolation: false };
  };

  const handleSetupComplete = (
    player1Word: string,
    player2Word: string,
    player1Name: string,
    player2Name: string
  ) => {
    setGameState(prev => ({
      ...prev,
      players: {
        player1: { ...prev.players.player1, secretWord: player1Word, name: player1Name },
        player2: { ...prev.players.player2, secretWord: player2Word, name: player2Name },
      },
      gamePhase: 'playing',
    }));
  };

  const handleSendMessage = (content: string, isQuestion: boolean = false) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      playerId: gameState.currentTurn,
      content,
      timestamp: Date.now(),
      isQuestion,
    };

    // Check for violations
    const violation = checkForForbiddenWords(content, gameState.currentTurn);

    setGameState(prev => {
      const newMessages = [...prev.messages, newMessage];

      if (violation.hasViolation) {
        return {
          ...prev,
          messages: newMessages,
          winner: violation.winner as 'player1' | 'player2',
          winReason: violation.reason,
          gamePhase: 'ended',
        };
      }

      return {
        ...prev,
        messages: newMessages,
        currentTurn: prev.currentTurn === 'player1' ? 'player2' : 'player1',
      };
    });
  };

  const handleRestart = () => {
    setGameState(INITIAL_GAME_STATE);
  };

  return (
    <div className="py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex justify-center space-x-4">
            {[
              { key: 'setup', label: 'Game Setup' },
              { key: 'playing', label: 'Playing' },
              { key: 'ended', label: 'Game End' },
            ].map((step, index) => (
              <div key={step.key} className={`flex items-center ${index < 2 ? 'flex-1' : ''}`}>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    gameState.gamePhase === step.key
                      ? 'bg-space-purple text-cream-white'
                      : (gameState.gamePhase === 'playing' && step.key === 'setup') ||
                          (gameState.gamePhase === 'ended' &&
                            (step.key === 'setup' || step.key === 'playing'))
                        ? 'bg-space-blue text-cream-white'
                        : 'bg-space-dark text-slate-400'
                  }`}
                >
                  {index + 1}
                </div>
                <span className="ml-2 text-sm font-medium hidden sm:block text-cream-white">
                  {step.label}
                </span>
                {index < 2 && <div className="flex-1 h-0.5 bg-space-dark mx-4 hidden sm:block" />}
              </div>
            ))}
          </div>
        </div>

        {/* Game content */}
        <div className="bg-space-dark border border-space-purple/30 rounded-2xl p-8 md:p-12">
          {gameState.gamePhase === 'setup' && (
            <SecretWordSetup onSetupComplete={handleSetupComplete} />
          )}

          {gameState.gamePhase === 'playing' && (
            <SecretWordChat gameState={gameState} onSendMessage={handleSendMessage} />
          )}

          {gameState.gamePhase === 'ended' && (
            <SecretWordEnd gameState={gameState} onRestart={handleRestart} />
          )}
        </div>
      </div>
    </div>
  );
}
