'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useTriviaStore } from '../hooks/useTriviaStore'
import { getTodayPST } from '../lib/triviaUtils'
import type { TriviaQuestion, CheckAnswerResponse } from '../models/questions'
import type { TriviaAnswer, TriviaGameResult } from '../models/trivia'

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

export function TriviaGame({ onFinish }: { onFinish: (result: TriviaGameResult) => void }) {
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
        <p className="text-red-400">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    )
  }

  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="text-cream-white/60 text-lg">Loading questions...</div>
      </div>
    )
  }

  if (phase === 'finished') {
    return null // Parent will handle showing results
  }

  const question = questions[currentIndex]
  const config = getQuestionConfig(question)
  const timerPercent = (timeRemaining / config.timeLimit) * 100
  const timerColor = timerPercent > 60 ? 'bg-green-500' : timerPercent > 30 ? 'bg-yellow-500' : 'bg-red-500'

  // Difficulty badge colors
  const diffBadgeColor = {
    easy: 'bg-green-600/30 text-green-400 border-green-600/50',
    medium: 'bg-yellow-600/30 text-yellow-400 border-yellow-600/50',
    hard: 'bg-red-600/30 text-red-400 border-red-600/50',
  }[question.difficulty]

  return (
    <div className="flex flex-col gap-3 sm:gap-4 max-w-lg mx-auto py-2 sm:py-4">
      {/* Top bar: progress + score */}
      <div className="flex justify-between items-center">
        <div className="flex gap-1.5">
          {questions.map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full ${
                i < currentIndex
                  ? answers[i]?.correct
                    ? 'bg-green-500'
                    : 'bg-red-500'
                  : i === currentIndex
                  ? 'bg-space-gold'
                  : 'bg-space-grey'
              }`}
            />
          ))}
        </div>
        <div className="text-space-gold font-bold text-lg">{totalScore} pts</div>
      </div>

      {/* Timer bar */}
      <div className="w-full bg-space-grey rounded-full h-2 overflow-hidden">
        <div
          className={`h-full ${timerColor} transition-all duration-100 ease-linear`}
          style={{ width: `${timerPercent}%` }}
        />
      </div>
      <div className="text-center text-sm text-cream-white/60">
        {Math.ceil(timeRemaining)}s
      </div>

      {/* Question card */}
      <Card className="bg-space-dark/80 border-space-grey">
        <CardHeader className="pb-2 pt-3 sm:pt-6 px-4 sm:px-6">
          <div className="flex justify-between items-center">
            <span className="text-cream-white/50 text-xs sm:text-sm">
              Question {currentIndex + 1}/{questions.length}
            </span>
            <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full border ${diffBadgeColor}`}>
              {question.difficulty.toUpperCase()}
            </span>
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
          <p className="text-cream-white text-base sm:text-lg mb-3 sm:mb-4 leading-snug">{question.question}</p>

          {/* Multiple choice options */}
          {question.options ? (
            <div className="flex flex-col gap-1.5 sm:gap-2">
              {question.options.map((option, i) => {
                const letter = String.fromCharCode(65 + i)
                let btnClass = 'w-full justify-start text-left py-2.5 sm:py-3 px-3 sm:px-4 text-sm sm:text-base whitespace-normal h-auto min-h-[2.75rem]'

                if (phase === 'answered' && answerResult) {
                  if (option === answerResult.correctAnswer) {
                    btnClass += ' bg-green-600/30 border-green-500 text-green-300'
                  } else if (option === selectedAnswer && !answerResult.correct) {
                    btnClass += ' bg-red-600/30 border-red-500 text-red-300'
                  } else {
                    btnClass += ' opacity-50'
                  }
                }

                return (
                  <Button
                    key={i}
                    variant="outline"
                    className={btnClass}
                    disabled={phase !== 'playing' || isChecking}
                    onClick={() => submitAnswer(option)}
                  >
                    <span className="font-bold mr-2 text-space-gold">{letter}.</span>
                    {option}
                  </Button>
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
                className="bg-space-black/50 border-space-grey text-cream-white"
                disabled={phase !== 'playing' || isChecking}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && textAnswer.trim()) {
                    submitAnswer(textAnswer.trim())
                  }
                }}
              />
              <Button
                variant="space"
                disabled={phase !== 'playing' || isChecking || !textAnswer.trim()}
                onClick={() => submitAnswer(textAnswer.trim())}
              >
                {isChecking ? 'Checking...' : 'Submit Answer'}
              </Button>
            </div>
          )}

          {/* Answer feedback */}
          {phase === 'answered' && answerResult && (
            <div className={`mt-4 p-3 rounded-lg ${
              answerResult.correct
                ? 'bg-green-600/20 border border-green-600/40'
                : 'bg-red-600/20 border border-red-600/40'
            }`}>
              <div className="font-bold mb-1">
                {answerResult.correct ? (
                  <span className="text-green-400">
                    Correct! +{answers[answers.length - 1]?.points || 0} pts
                  </span>
                ) : (
                  <span className="text-red-400">
                    {timeRemaining <= 0 ? "Time's up!" : 'Incorrect'} — 0 pts
                  </span>
                )}
              </div>
              {!answerResult.correct && (
                <div className="text-cream-white/70 text-sm">
                  Answer: <span className="text-cream-white font-medium">{answerResult.correctAnswer}</span>
                </div>
              )}
              {answerResult.explanation && (
                <div className="text-cream-white/50 text-sm mt-1">
                  {answerResult.explanation}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Next button */}
      {phase === 'answered' && (
        <Button variant="space" size="lg" className="w-full py-4" onClick={nextQuestion}>
          {currentIndex + 1 >= questions.length ? 'See Results' : 'Next Question'}
        </Button>
      )}
    </div>
  )
}
