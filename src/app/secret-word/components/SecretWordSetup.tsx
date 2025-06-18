'use client';

import { useState } from 'react';
import { Button } from '@/app/voters/components/ui/button';
import { Input } from '@/app/voters/components/ui/input';

interface SecretWordSetupProps {
  onSetupComplete: (playerWord: string, playerName: string) => void | Promise<void>;
  isLoading?: boolean;
}

export function SecretWordSetup({ onSetupComplete, isLoading = false }: SecretWordSetupProps) {
  const [playerName, setPlayerName] = useState('Player');
  const [playerWord, setPlayerWord] = useState('');

  const canProceed = playerWord.trim() && playerName.trim();

  const handleProceed = () => {
    if (canProceed) {
      onSetupComplete(playerWord.trim(), playerName.trim());
    }
  };

  const generateRandomWord = () => {
    const words = [
      'elephant',
      'butterfly',
      'mountain',
      'ocean',
      'rainbow',
      'thunder',
      'whisper',
      'crystal',
      'garden',
      'miracle',
      'adventure',
      'mystery',
      'harmony',
      'serenity',
      'wisdom',
      'courage',
      'friendship',
      'treasure',
      'journey',
      'discovery',
      'imagination',
      'creativity',
      'inspiration',
      'celebration',
      'laughter',
      'sunshine',
      'moonlight',
      'starlight',
      'firefly',
      'blossom',
    ];
    return words[Math.floor(Math.random() * words.length)];
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-cream-white mb-4">Secret Word vs AI</h2>
        <p className="text-slate-400 mb-8 max-w-2xl mx-auto">
          Choose your secret word and challenge the AI! The goal is to make the AI say your word or
          guess the AI&apos;s word correctly. If you say your own word, you lose! Be strategic with
          your questions and answers.
        </p>
      </div>

      {/* Two-column layout (md+) for game rules and player setup */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Game Rules */}
        <div className="bg-space-purple/20 border border-space-purple/30 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-cream-white mb-4">Game Rules:</h3>
          <ul className="text-slate-300 space-y-2 text-sm">
            <li>• You select a secret word, the AI gets one too</li>
            <li>• Take turns asking questions and giving truthful answers</li>
            <li>
              • If you say <span className="underline">any</span> secret word (yours or the
              AI&apos;s), you lose immediately
            </li>
            <li>
              • If the AI says <span className="underline">any</span> secret word, it loses and you
              win
            </li>
            <li>
              • Your goal: Make the AI say <em>your</em> word without revealing it yourself
            </li>
            <li>• The AI is programmed to be challenging but fair – be creative!</li>
          </ul>
        </div>

        {/* Right column: setup + controls */}
        <div className="space-y-6">
          {/* Player Setup */}
          <div className="bg-space-blue/20 border border-space-blue/30 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-cream-white mb-4 text-center">Your Setup</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Your Name</label>
                <Input
                  type="text"
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-cream-white"
                  placeholder="Enter your name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Your Secret Word
                </label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={playerWord}
                    onChange={e => setPlayerWord(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-cream-white"
                    placeholder="Enter your secret word"
                  />
                  <Button
                    type="button"
                    onClick={() => setPlayerWord(generateRandomWord())}
                    variant="outline"
                    className="bg-transparent text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-cream-white"
                  >
                    Random
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}

          <div className="flex justify-center w-full">
            <Button
              onClick={handleProceed}
              disabled={!canProceed || isLoading}
              className="w-full bg-space-purple text-cream-white hover:bg-space-purple/90 px-8"
            >
              {isLoading ? 'Setting up game...' : 'Challenge AI'}
            </Button>
          </div>

          {!canProceed && (
            <div className="text-center md:text-left">
              <p className="text-slate-400 text-sm">
                Make sure you&apos;ve entered your name and secret word, then click &quot;Challenge
                AI&quot;
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
