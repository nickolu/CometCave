'use client';

import { useState } from 'react';
import { Button } from '@/app/voters/components/ui/button';
import { Input } from '@/app/voters/components/ui/input';

interface SecretWordSetupProps {
  onSetupComplete: (
    player1Word: string,
    player2Word: string,
    player1Name: string,
    player2Name: string
  ) => void;
}

export function SecretWordSetup({ onSetupComplete }: SecretWordSetupProps) {
  const [player1Name, setPlayer1Name] = useState('Player 1');
  const [player2Name, setPlayer2Name] = useState('Player 2');
  const [player1Word, setPlayer1Word] = useState('');
  const [player2Word, setPlayer2Word] = useState('');
  const [showWords, setShowWords] = useState(false);

  const canProceed =
    player1Word.trim() && player2Word.trim() && player1Name.trim() && player2Name.trim();

  const handleProceed = () => {
    if (canProceed) {
      onSetupComplete(
        player1Word.trim(),
        player2Word.trim(),
        player1Name.trim(),
        player2Name.trim()
      );
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
        <h2 className="text-3xl font-bold text-cream-white mb-4">Secret Word Game Setup</h2>
        <p className="text-slate-400 mb-8 max-w-2xl mx-auto">
          Each player must choose a secret word. The goal is to make your opponent say their own
          word or to guess their word correctly. If you say your own word, you lose! Be careful with
          your questions and answers.
        </p>
      </div>

      {/* Game Rules */}
      <div className="bg-space-purple/20 border border-space-purple/30 rounded-lg p-6 mb-8">
        <h3 className="text-lg font-semibold text-cream-white mb-4">Game Rules:</h3>
        <ul className="text-slate-300 space-y-2 text-sm">
          <li>• Each player selects a secret word</li>
          <li>• Players take turns asking questions and giving answers</li>
          <li>• All answers must be truthful</li>
          <li>• If you say your own secret word, you lose immediately</li>
          <li>• If you say your opponent's secret word, you win immediately</li>
          <li>• Try to trick your opponent into saying their word!</li>
        </ul>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Player 1 Setup */}
        <div className="bg-space-blue/20 border border-space-blue/30 rounded-lg p-6">
          <h3 className="text-xl font-semibold text-cream-white mb-4">Player 1</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Player Name</label>
              <Input
                type="text"
                value={player1Name}
                onChange={e => setPlayer1Name(e.target.value)}
                className="bg-slate-800 border-slate-700 text-cream-white"
                placeholder="Enter your name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Secret Word</label>
              <div className="flex gap-2">
                <Input
                  type={showWords ? 'text' : 'password'}
                  value={player1Word}
                  onChange={e => setPlayer1Word(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-cream-white"
                  placeholder="Enter your secret word"
                />
                <Button
                  type="button"
                  onClick={() => setPlayer1Word(generateRandomWord())}
                  variant="outline"
                  className="bg-transparent text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-cream-white"
                >
                  Random
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Player 2 Setup */}
        <div className="bg-space-purple/20 border border-space-purple/30 rounded-lg p-6">
          <h3 className="text-xl font-semibold text-cream-white mb-4">Player 2</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Player Name</label>
              <Input
                type="text"
                value={player2Name}
                onChange={e => setPlayer2Name(e.target.value)}
                className="bg-slate-800 border-slate-700 text-cream-white"
                placeholder="Enter your name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Secret Word</label>
              <div className="flex gap-2">
                <Input
                  type={showWords ? 'text' : 'password'}
                  value={player2Word}
                  onChange={e => setPlayer2Word(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-cream-white"
                  placeholder="Enter your secret word"
                />
                <Button
                  type="button"
                  onClick={() => setPlayer2Word(generateRandomWord())}
                  variant="outline"
                  className="bg-transparent text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-cream-white"
                >
                  Random
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex justify-center items-center gap-4">
        <Button
          type="button"
          onClick={() => setShowWords(!showWords)}
          variant="outline"
          className="bg-transparent text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-cream-white"
        >
          {showWords ? 'Hide Words' : 'Show Words'}
        </Button>

        <Button
          onClick={handleProceed}
          disabled={!canProceed}
          className="bg-space-purple text-cream-white hover:bg-space-purple/90 px-8"
        >
          Start Game
        </Button>
      </div>

      {canProceed && (
        <div className="text-center">
          <p className="text-slate-400 text-sm">
            Make sure both players have entered their names and secret words, then click "Start
            Game"
          </p>
        </div>
      )}
    </div>
  );
}
