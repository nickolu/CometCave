'use client'

import { Loader2 } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'

import { useGenerateWord, useScoreWord } from '@/app/secret-word/api/hooks'
import { ScoreWordResponse } from '@/app/secret-word/api/types'
import { ChunkyButton } from '@/components/ui/chunky-button'
import { Input } from '@/components/ui/input'

interface SecretWordSetupProps {
  onSetupComplete: (
    playerWord: string,
    playerName: string,
    wordScore: number
  ) => void | Promise<void>
  isLoading?: boolean
}

const WordScore = ({
  isScoring,
  scoreData,
}: {
  isScoring: boolean
  scoreData: ScoreWordResponse | undefined
}) => {
  const score = scoreData?.score

  if (isScoring) {
    return <div>Scoring...</div>
  }

  return (
    <div>
      This word is worth <span className="font-bold text-green-500">{score}</span> points
    </div>
  )
}

const MINIMUM_WORD_SCORE = 10

export function SecretWordSetup({ onSetupComplete, isLoading = false }: SecretWordSetupProps) {
  const [playerName, setPlayerName] = useState('Player')
  const [playerWord, setPlayerWord] = useState('')
  const [previousRandomWords, setPreviousRandomWords] = useState<string[]>([])

  const { mutateAsync: generateWord, isPending: isGenerating } = useGenerateWord()

  const { mutateAsync: scoreWord, isPending: isScoring, data: scoreData } = useScoreWord()
  const currentWordScore = scoreData?.score ?? -1
  const canProceed =
    playerWord.trim() &&
    playerName.trim() &&
    scoreData?.score !== undefined &&
    scoreData?.score >= MINIMUM_WORD_SCORE &&
    !isScoring

  const wordScoreTimeout = useRef<NodeJS.Timeout | null>(null)

  const handleProceed = async () => {
    if (canProceed && scoreData?.score) {
      onSetupComplete(playerWord.trim(), playerName.trim(), scoreData.score)
    }
  }

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // replace spaces with empty string
      const value = e.target.value.replace(/\s/g, '')
      setPlayerWord(value)
      if (wordScoreTimeout.current) {
        clearTimeout(wordScoreTimeout.current)
      }
      wordScoreTimeout.current = setTimeout(() => {
        if (value.trim()) {
          scoreWord({ word: value.trim() })
        }
      }, 1000)
      return () => {
        if (wordScoreTimeout.current) {
          clearTimeout(wordScoreTimeout.current)
        }
      }
    },
    [scoreWord]
  )

  const generateRandomWord = useCallback(async () => {
    const { word } = await generateWord({ avoidWords: previousRandomWords })
    setPreviousRandomWords(prev => [...prev, word])
    setPlayerWord(word)
    scoreWord({ word })
  }, [generateWord, previousRandomWords, scoreWord])

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-on-surface mb-4">Secret Word vs AI</h2>
        <p className="text-on-surface-variant mb-8 max-w-2xl mx-auto">
          Choose your secret word and challenge the AI! The goal is to make the AI say your before
          you say theirs. If you say your own word, you lose! Be strategic with your questions and
          answers.
        </p>
      </div>

      {/* Two-column layout (md+) for game rules and player setup */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Game Rules */}
        <div className="bg-surface-variant/20 border border-surface-variant/30 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-on-surface mb-4">Game Rules:</h3>
          <ul className="text-on-surface-variant space-y-2 text-sm">
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
            <h3 className="text-xl font-semibold text-on-surface mb-4 text-center">Your Setup</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-2">Your Name</label>
                <Input
                  type="text"
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value)}
                  className="bg-surface-container-highest border-outline-variant text-on-surface"
                  placeholder="Enter your name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-2">
                  Your Secret Word
                </label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={playerWord}
                    onChange={handleInputChange}
                    className="bg-surface-container-highest border-outline-variant text-on-surface"
                    placeholder="Enter your secret word"
                  />
                  <ChunkyButton
                    type="button"
                    onClick={generateRandomWord}
                    variant="ghost"
                    className="bg-transparent text-on-surface-variant border-outline-variant hover:bg-surface-container-highest hover:text-on-surface"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <span className="text-on-surface-variant">Random</span>
                    )}
                  </ChunkyButton>
                </div>
                <div className="text-sm text-on-surface-variant mt-2">
                  <WordScore isScoring={isScoring} scoreData={scoreData} />
                  {currentWordScore === 0 && (
                    <div className="text-center md:text-left">
                      <p className="text-on-surface-variant text-sm">
                        Invalid word. Please enter a valid word.
                      </p>
                    </div>
                  )}
                  {currentWordScore > 0 && currentWordScore < MINIMUM_WORD_SCORE && (
                    <div className="text-center md:text-left">
                      <p className="text-on-surface-variant text-sm">
                        Your word is too common. Please enter a more unique word.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center w-full">
            <ChunkyButton
              onClick={handleProceed}
              disabled={!canProceed || isLoading}
              className="w-full bg-surface-variant text-on-surface hover:bg-surface-variant/90 px-8"
            >
              {isLoading ? 'Setting up game...' : 'Challenge AI'}
            </ChunkyButton>
          </div>
        </div>
      </div>
    </div>
  )
}
