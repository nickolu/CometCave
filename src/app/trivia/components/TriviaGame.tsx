'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { CheckAnswerResponse, TriviaQuestion } from '@/app/trivia/models/questions'
import type { TriviaAnswer, TriviaGameResult } from '@/app/trivia/models/trivia'
import { AnswerOption } from '@/components/ui/answer-option'
import { ChunkyButton } from '@/components/ui/chunky-button'
import { ChunkyCard, ChunkyCardContent, ChunkyCardHeader } from '@/components/ui/chunky-card'
import { Input } from '@/components/ui/input'
import { getTodayPST } from '@/lib/dates'

import { TriviaHUD } from './TriviaHUD'

// Scoring config per difficulty
const SCORING = {
  easy: { maxPoints: 300, timeLimit: 30 },
  medium: { maxPoints: 450, timeLimit: 30 },
  hard: { maxPoints: 600, timeLimit: 30 },
} as const

// AI questions get more time
function getQuestionConfig(q: TriviaQuestion) {
  const base = SCORING[q.difficulty]
  if (q.source === 'ai') {
    return { maxPoints: 600, timeLimit: 60 }
  }
  return base
}

type GamePhase = 'loading' | 'playing' | 'answered' | 'finished'

export function TriviaGame({ onFinish, onFlee }: { onFinish: (result: TriviaGameResult) => void; onFlee?: () => void }) {
  const [questions, setQuestions] = useState<TriviaQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [phase, setPhase] = useState<GamePhase>('loading')
  const [error, setError] = useState<string | null>(null)

  // Timer state
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [timeLimit, setTimeLimit] = useState(30)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  // Answer state
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [textAnswer, setTextAnswer] = useState('')
  const [answerResult, setAnswerResult] = useState<CheckAnswerResponse | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  // Game results
  const [answers, setAnswers] = useState<TriviaAnswer[]>([])
  const [totalScore, setTotalScore] = useState(0)

  // Fetch questions on mount
  useEffect(() => {
    async function fetchQuestions() {
      try {
        const res = await fetch('/api/v1/trivia/daily')
        if (!res.ok) throw new Error('Failed to fetch questions')
        const data = await res.json()
        setQuestions(data.questions)
        if (data.questions.length > 0) {
          const config = getQuestionConfig(data.questions[0])
          setTimeLimit(config.timeLimit)
          setTimeRemaining(config.timeLimit)
          setPhase('playing')
        }
      } catch (err) {
        setError('Failed to load questions. Please try again.')
      }
    }
    fetchQuestions()
  }, [])

  // Timer logic
  useEffect(() => {
    if (phase !== 'playing') return

    startTimeRef.current = Date.now()
    const config = getQuestionConfig(questions[currentIndex])
    setTimeLimit(config.timeLimit)
    setTimeRemaining(config.timeLimit)

    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000
      const remaining = Math.max(0, config.timeLimit - elapsed)
      setTimeRemaining(remaining)

      if (remaining <= 0) {
        // Time's up — auto-submit as incorrect
        if (timerRef.current) clearInterval(timerRef.current)
        handleTimeUp()
      }
    }, 100)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [phase, currentIndex, questions])

  const handleTimeUp = useCallback(() => {
    const config = getQuestionConfig(questions[currentIndex])
    const elapsed = config.timeLimit * 1000

    setAnswerResult({ correct: false, correctAnswer: '(Time expired)', explanation: undefined })

    const answer: TriviaAnswer = {
      questionIndex: currentIndex,
      correct: false,
      points: 0,
      timeMs: elapsed,
    }
    setAnswers(prev => [...prev, answer])
    setPhase('answered')
  }, [currentIndex, questions])

  const submitAnswer = useCallback(async (answer: string) => {
    if (phase !== 'playing' || isChecking) return

    // Stop timer
    if (timerRef.current) clearInterval(timerRef.current)
    const elapsedMs = Date.now() - startTimeRef.current

    setIsChecking(true)
    setSelectedAnswer(answer)

    try {
      const today = getTodayPST()
      const question = questions[currentIndex]

      const res = await fetch('/api/v1/trivia/check-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question.id,
          answer,
          date: today,
        }),
      })

      if (!res.ok) throw new Error('Failed to check answer')
      const result: CheckAnswerResponse = await res.json()
      setAnswerResult(result)

      // Calculate points
      const config = getQuestionConfig(question)
      const timeRemainingAtAnswer = Math.max(0, config.timeLimit - elapsedMs / 1000)
      const points = result.correct
        ? Math.max(0, Math.round(config.maxPoints * (timeRemainingAtAnswer / config.timeLimit)))
        : 0

      const triviaAnswer: TriviaAnswer = {
        questionIndex: currentIndex,
        correct: result.correct,
        points,
        timeMs: elapsedMs,
      }

      setAnswers(prev => [...prev, triviaAnswer])
      setTotalScore(prev => prev + points)
      setPhase('answered')
    } catch (err) {
      setError('Failed to check answer. Please try again.')
    } finally {
      setIsChecking(false)
    }
  }, [phase, isChecking, currentIndex, questions])

  const nextQuestion = useCallback(() => {
    if (currentIndex + 1 >= questions.length) {
      // Game over
      const today = getTodayPST()
      const correctCount = answers.length > 0 ? answers.filter(a => a.correct).length : 0
      // Include the latest answer that was just added
      const allAnswers = answers
      const finalScore = allAnswers.reduce((sum, a) => sum + a.points, 0)

      const result: TriviaGameResult = {
        date: today,
        score: finalScore,
        correct: correctCount,
        total: questions.length,
        answers: allAnswers,
      }

      setPhase('finished')
      onFinish(result)
    } else {
      setCurrentIndex(prev => prev + 1)
      setSelectedAnswer(null)
      setTextAnswer('')
      setAnswerResult(null)
      setPhase('playing')
    }
  }, [currentIndex, questions, answers, onFinish])

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <p className="text-ds-error">{error}</p>
        <ChunkyButton variant="secondary" onClick={() => window.location.reload()}>
          Try Again
        </ChunkyButton>
      </div>
    )
  }

  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="text-on-surface/60 text-lg">Loading questions...</div>
      </div>
    )
  }

  if (phase === 'finished') {
    return null // Parent will handle showing results
  }

  const question = questions[currentIndex]
  const config = getQuestionConfig(question)

  // Difficulty badge colors
  const diffBadgeColor = {
    easy: 'bg-green-600/30 text-green-400 border-green-600/50',
    medium: 'bg-yellow-600/30 text-yellow-400 border-yellow-600/50',
    hard: 'bg-red-600/30 text-red-400 border-red-600/50',
  }[question.difficulty]

  return (
    <div className="flex flex-col gap-3 sm:gap-4 max-w-lg mx-auto py-2 sm:py-4">
      {/* HUD: Flee + score + timer + progress */}
      <TriviaHUD
        currentQuestion={currentIndex}
        totalQuestions={questions.length}
        score={totalScore}
        timeRemaining={timeRemaining}
        timeLimit={config.timeLimit}
        onFlee={onFlee ?? (() => window.location.reload())}
        isPlaying={phase === 'playing'}
      />

      {/* Question card */}
      <ChunkyCard variant="surface-variant" shadow="hero">
        <ChunkyCardHeader className="pb-2 pt-3 sm:pt-6 px-4 sm:px-6">
          <div className="flex justify-between items-center">
            <span className="text-on-surface/50 text-xs sm:text-sm">
              Question {currentIndex + 1}/{questions.length}
            </span>
            <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full border ${diffBadgeColor}`}>
              {question.difficulty.toUpperCase()}
            </span>
          </div>
        </ChunkyCardHeader>
        <ChunkyCardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
          <p aria-live="polite" className="text-on-surface text-base sm:text-lg mb-3 sm:mb-4 leading-snug">{question.question}</p>

          {/* Multiple choice options */}
          {question.options ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {question.options.map((option, i) => {
                const letter = (['A', 'B', 'C', 'D'] as const)[i]
                let state: 'idle' | 'correct' | 'wrong' | 'disabled' = 'idle'

                if (phase === 'answered' && answerResult) {
                  if (option === answerResult.correctAnswer) {
                    state = 'correct'
                  } else if (option === selectedAnswer && !answerResult.correct) {
                    state = 'wrong'
                  } else {
                    state = 'disabled'
                  }
                }

                return (
                  <AnswerOption
                    key={i}
                    letter={letter}
                    label={option}
                    state={phase !== 'playing' || isChecking ? 'disabled' : state}
                    selected={selectedAnswer === option}
                    onSelect={() => submitAnswer(option)}
                  />
                )
              })}
            </div>
          ) : (
            /* Free-text input for AI questions */
            <div className="flex flex-col gap-2">
              <Input
                value={textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
                placeholder="Type your answer..."
                className="bg-surface-dim/50 border-outline-variant text-on-surface"
                disabled={phase !== 'playing' || isChecking}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && textAnswer.trim()) {
                    submitAnswer(textAnswer.trim())
                  }
                }}
              />
              <ChunkyButton
                variant="primary"
                disabled={phase !== 'playing' || isChecking || !textAnswer.trim()}
                onClick={() => submitAnswer(textAnswer.trim())}
              >
                {isChecking ? 'Checking...' : 'Submit Answer'}
              </ChunkyButton>
            </div>
          )}

          {/* Answer feedback */}
          {phase === 'answered' && answerResult && (
            <div className={`mt-4 p-3 rounded-lg ${
              answerResult.correct
                ? 'bg-primary-container/20 border border-primary-container/40'
                : 'bg-ds-error/20 border border-ds-error/40'
            }`}>
              <div className="font-bold mb-1">
                {answerResult.correct ? (
                  <span className="text-ds-primary">
                    Correct! +{answers[answers.length - 1]?.points || 0} pts
                  </span>
                ) : (
                  <span className="text-ds-error">
                    {timeRemaining <= 0 ? "Time's up!" : 'Incorrect'} — 0 pts
                  </span>
                )}
              </div>
              {!answerResult.correct && (
                <div className="text-on-surface/70 text-sm">
                  Answer: <span className="text-on-surface font-medium">{answerResult.correctAnswer}</span>
                </div>
              )}
              {answerResult.explanation && (
                <div className="text-on-surface/50 text-sm mt-1">
                  {answerResult.explanation}
                </div>
              )}
            </div>
          )}
        </ChunkyCardContent>
      </ChunkyCard>

      {/* Next button */}
      {phase === 'answered' && (
        <ChunkyButton variant="primary" size="lg" className="w-full" onClick={nextQuestion}>
          {currentIndex + 1 >= questions.length ? 'See Results' : 'Next Question'}
        </ChunkyButton>
      )}
    </div>
  )
}
