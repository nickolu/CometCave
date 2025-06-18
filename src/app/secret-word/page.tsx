'use client';

import { useState } from 'react';
import { SecretWordSetup } from '@/app/secret-word/components/SecretWordSetup';
import { SecretWordChat } from '@/app/secret-word/components/SecretWordChat';
import { SecretWordEnd } from '@/app/secret-word/components/SecretWordEnd';
import { QueryProvider } from './providers/QueryProvider';
import { useGenerateWord, useAIResponse } from './api/hooks';

type GamePhase = 'setup' | 'playing' | 'ended';

export interface Player {
  id: 'player' | 'ai';
  name: string;
  secretWord: string;
  isAI?: boolean;
}

export interface Message {
  id: string;
  playerId: 'player' | 'ai';
  content: string;
  timestamp: number;
  isQuestion?: boolean;
}

export interface GameState {
  players: {
    player: Player;
    ai: Player;
  };
  currentTurn: 'player' | 'ai';
  messages: Message[];
  winner?: 'player' | 'ai';
  winReason?: string;
  gamePhase: GamePhase;
}

const INITIAL_GAME_STATE: GameState = {
  players: {
    player: { id: 'player', name: 'Player', secretWord: '' },
    ai: { id: 'ai', name: 'AI Assistant', secretWord: '', isAI: true },
  },
  currentTurn: 'player',
  messages: [],
  gamePhase: 'setup',
};

function SecretWordGameContent() {
  const [gameState, setGameState] = useState<GameState>(INITIAL_GAME_STATE);
  const generateWord = useGenerateWord();
  const getAIResponse = useAIResponse();

  // Check for forbidden words in messages
  const checkForForbiddenWords = (message: string, playerId: 'player' | 'ai') => {
    const lowerMessage = message.toLowerCase();
    const playerWord = gameState.players.player.secretWord.toLowerCase();
    const aiWord = gameState.players.ai.secretWord.toLowerCase();

    const speaker = playerId;

    // Helper to generate standard violation result
    const violationResult = (winner: 'player' | 'ai', reason: string) => ({
      hasViolation: true,
      winner,
      reason,
    });

    // If message includes the player's secret word
    if (lowerMessage.includes(playerWord)) {
      if (speaker === 'player') {
        return violationResult(
          'ai',
          `You said your secret word: "${gameState.players.player.secretWord}"`
        );
      } else {
        return violationResult(
          'player',
          `AI said your secret word: "${gameState.players.player.secretWord}"`
        );
      }
    }

    // If message includes the AI's secret word
    if (lowerMessage.includes(aiWord)) {
      if (speaker === 'ai') {
        return violationResult(
          'player',
          `AI said its secret word: "${gameState.players.ai.secretWord}"`
        );
      } else {
        return violationResult(
          'ai',
          `You said the AI's secret word: "${gameState.players.ai.secretWord}"`
        );
      }
    }

    return { hasViolation: false, winner: undefined, reason: undefined };
  };

  const handleSetupComplete = async (playerWord: string, playerName: string) => {
    try {
      // Generate AI word using OpenAI
      const result = await generateWord.mutateAsync({
        difficulty: 'medium',
        avoidWords: [playerWord], // Avoid the player's word
      });

      setGameState(prev => ({
        ...prev,
        players: {
          player: { ...prev.players.player, secretWord: playerWord, name: playerName },
          ai: { ...prev.players.ai, secretWord: result.word },
        },
        gamePhase: 'playing',
      }));
    } catch (error) {
      console.error('Failed to generate AI word:', error);
      // Fallback to a random word if API fails
      const fallbackWords = [
        'butterfly',
        'adventure',
        'wisdom',
        'castle',
        'thunder',
        'crystal',
        'rainbow',
        'treasure',
      ];
      const randomWord = fallbackWords[Math.floor(Math.random() * fallbackWords.length)];

      setGameState(prev => ({
        ...prev,
        players: {
          player: { ...prev.players.player, secretWord: playerWord, name: playerName },
          ai: { ...prev.players.ai, secretWord: randomWord },
        },
        gamePhase: 'playing',
      }));
    }
  };

  const handleSendMessage = async (content: string, isQuestion: boolean = false) => {
    // Create the new player message that just came in
    const newMessage: Message = {
      id: Date.now().toString(),
      playerId: gameState.currentTurn,
      content,
      timestamp: Date.now(),
      isQuestion,
    };

    // Helper we will reuse to append a message to the log
    const appendMessage = (msg: Message) =>
      setGameState(current => ({ ...current, messages: [...current.messages, msg] }));

    // ---------------------------
    // 1. Check for rule violations
    // ---------------------------
    const violation = checkForForbiddenWords(content, gameState.currentTurn);
    if (violation.hasViolation) {
      setGameState(prev => ({
        ...prev,
        messages: [...prev.messages, newMessage],
        winner: violation.winner as 'player' | 'ai',
        winReason: violation.reason,
        gamePhase: 'ended',
      }));
      return;
    }

    // ---------------------------
    // 2. Persist the player message + advance the turn
    // ---------------------------
    const nextTurn: 'player' | 'ai' = gameState.currentTurn === 'player' ? 'ai' : 'player';
    const updatedMessages = [...gameState.messages, newMessage];

    setGameState(prev => ({
      ...prev,
      messages: updatedMessages,
      currentTurn: nextTurn,
    }));

    // ---------------------------
    // 3. If it's now the AI's turn, queue up an AI response
    //    This side-effect is outside of the setState updater so it
    //    will only run once, even under React 18 StrictMode.
    // ---------------------------
    if (nextTurn === 'ai') {
      const delay = 1000 + Math.random() * 2000; // 1-3 seconds delay for natural feel

      setTimeout(async () => {
        try {
          const aiResponseResult = await getAIResponse.mutateAsync({
            playerMessage: content,
            aiSecretWord: gameState.players.ai.secretWord,
            gameMessages: updatedMessages.map(msg => ({
              playerId: msg.playerId,
              content: msg.content,
              timestamp: msg.timestamp,
            })),
            isPlayerTurn: false,
          });

          const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            playerId: 'ai',
            content: aiResponseResult.response,
            timestamp: Date.now() + 1,
            isQuestion: aiResponseResult.isQuestion,
          };

          // If AI violated a rule while generating its response
          if (aiResponseResult.violation) {
            setGameState(current => ({
              ...current,
              messages: [...current.messages, aiMessage],
              winner: aiResponseResult.violation!.winner,
              winReason: aiResponseResult.violation!.reason,
              gamePhase: 'ended',
            }));
            return;
          }

          // Check violations detected locally (e.g., guessing player word)
          const aiViolation = checkForForbiddenWords(aiResponseResult.response, 'ai');
          if (aiViolation.hasViolation) {
            setGameState(current => ({
              ...current,
              messages: [...current.messages, aiMessage],
              winner: aiViolation.winner as 'player' | 'ai',
              winReason: aiViolation.reason,
              gamePhase: 'ended',
            }));
            return;
          }

          // Normal flow – append AI message and pass the turn back to the player
          setGameState(current => ({
            ...current,
            messages: [...current.messages, aiMessage],
            currentTurn: 'player',
          }));
        } catch (error) {
          console.error('Failed to get AI response:', error);

          const fallbackResponses = [
            "That's interesting!",
            'Can you tell me more?',
            'I see what you mean.',
            "That's a good point.",
            'What else can you share?',
          ];
          const fallbackResponse =
            fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];

          const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            playerId: 'ai',
            content: fallbackResponse,
            timestamp: Date.now() + 1,
            isQuestion: fallbackResponse.includes('?'),
          };

          appendMessage(aiMessage);
          setGameState(current => ({ ...current, currentTurn: 'player' }));
        }
      }, delay);
    }
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
              { key: 'playing', label: 'Playing vs AI' },
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
            <SecretWordSetup
              onSetupComplete={handleSetupComplete}
              isLoading={generateWord.isPending}
            />
          )}

          {gameState.gamePhase === 'playing' && (
            <SecretWordChat
              gameState={gameState}
              onSendMessage={handleSendMessage}
              isAIThinking={getAIResponse.isPending}
            />
          )}

          {gameState.gamePhase === 'ended' && (
            <SecretWordEnd gameState={gameState} onRestart={handleRestart} />
          )}
        </div>
      </div>
    </div>
  );
}

export default function SecretWordGame() {
  return (
    <QueryProvider>
      <SecretWordGameContent />
    </QueryProvider>
  );
}
