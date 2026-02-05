import { CircularProgress, TextField } from '@mui/material'
import { useEffect, useRef, useState } from 'react'

import { possibleHexagrams } from '@/app/oracle/possible-hexagrams'
import {
  ChangingLines,
  DivinationQuestion,
  DivinationResult,
  Hexagram as HexagramType,
} from '@/app/oracle/types'
import { getInterpretation } from '@/app/oracle/utils/interpret-reading'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'

import { TransitionWrapper } from './ui/transition-wrapper'

export function xmur3(str: string) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return (h ^= h >>> 16) >>> 0
  }
}

// Deterministic RNG that returns numbers in [0, 1)
export function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function getRandomNumbersWithSeed({
  seed,
  min,
  max,
  numberOfNumbers,
}: {
  seed: string
  min: number
  max: number
  numberOfNumbers: number
}) {
  const seedFn = xmur3(seed)
  const rng = mulberry32(seedFn())
  return Array.from({ length: numberOfNumbers }, () => Math.floor(rng() * (max - min + 1)) + min)
}

function findChangingLineNumbers(hexagram1: HexagramType, hexagram2: HexagramType): number[] {
  const changingLineNumbers: number[] = []
  for (let i = 0; i < 6; i++) {
    if (hexagram1[i] !== hexagram2[i]) {
      changingLineNumbers.push(i + 1)
    }
  }
  return changingLineNumbers
}

// Changing lines are reversed here so the first line is the bottom line of the hexagram
// everywhere else we can use the lines in order from 0 to 5 from top to bottom and
// line 6 will be the top line of the hexagram and line 1 will be the bottom line of the hexagram
function generateHexagramFromNumber(number: number): DivinationResult {
  const lines: ChangingLines = [undefined, undefined, undefined, undefined, undefined, undefined]

  const [hexagram1Number, hexagram2Number] = getRandomNumbersWithSeed({
    seed: number.toString(),
    min: 1,
    max: 64,
    numberOfNumbers: 2,
  })

  const hexagram1 =
    possibleHexagrams.find(hexagram => hexagram.number === hexagram1Number) ?? possibleHexagrams[0]
  const hexagram2 =
    possibleHexagrams.find(hexagram => hexagram.number === hexagram2Number) ?? possibleHexagrams[0]
  const changingLineNumbers = findChangingLineNumbers(hexagram1?.hexagram, hexagram2?.hexagram)
  for (let i = 0; i < 6; i++) {
    const isChangingLine = changingLineNumbers.includes(i + 1)
    lines[i] = { type: hexagram1?.hexagram[i] ? 'solid' : 'broken', hasChanges: isChangingLine }
  }
  return {
    changingLines: lines.reverse() as ChangingLines,
    hexagram1: hexagram1,
    hexagram2: hexagram2,
  }
}

export const GenerateHexagram = ({
  divinationQuestion,
  setDivinationResult,
  onDivinationEntryComplete,
}: {
  divinationQuestion: DivinationQuestion
  setDivinationResult: (divinationResult: DivinationResult | null) => void
  onDivinationEntryComplete: (divinationResult: DivinationResult) => void
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [generatedNumber, setGeneratedNumber] = useState(0)
  const [resetTimes, setResetTimes] = useState(0)
  const [isLoadingInterpretation, setIsLoadingInterpretation] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let isDrawing = false
    let lastX = 0
    let lastY = 0

    const handleMouseDown = (e: MouseEvent) => {
      isDrawing = true
      const rect = canvas.getBoundingClientRect()
      lastX = e.clientX - rect.left
      lastY = e.clientY - rect.top
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDrawing) return

      const rect = canvas.getBoundingClientRect()
      const currentX = e.clientX - rect.left
      const currentY = e.clientY - rect.top

      setGeneratedNumber(prev => prev + currentX + currentY)

      ctx.beginPath()
      ctx.moveTo(lastX, lastY)
      ctx.lineTo(currentX, currentY)
      ctx.strokeStyle = 'black'
      ctx.lineWidth = 18
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.stroke()

      lastX = currentX
      lastY = currentY
    }

    const handleMouseUp = () => {
      isDrawing = false
    }

    canvasRef.current = canvas
    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseup', handleMouseUp)

    return () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      setGeneratedNumber(0)
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resetTimes])

  const handleGenerateHexagram = async () => {
    setIsLoadingInterpretation(true)
    const hexagram = generateHexagramFromNumber(generatedNumber)

    // Get AI interpretation
    const interpretation = await getInterpretation(divinationQuestion, hexagram)
    hexagram.interpretation = interpretation

    setIsLoadingInterpretation(false)
    onDivinationEntryComplete(hexagram)
  }

  const handleReset = () => {
    setResetTimes(resetTimes + 1)
    setDivinationResult(null)
    setGeneratedNumber(0)
  }

  if (isLoadingInterpretation) {
    return (
      <div className="w-full space-y-8 items-center justify-center flex flex-col">
        <Typography variant="h2">Generating Your Reading...</Typography>
        <CircularProgress size={40} />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4 max-w-xl mx-auto">
        <Typography variant="h2">Generate Hexagram with Divination</Typography>
        <Typography variant="h4">
          Your question: &quot;{divinationQuestion.question}&quot;
        </Typography>
        <Typography>
          Hold the question in your mind and let your subconscious guide your mouse as you scribble
          on the canvas
        </Typography>
      </div>
      <div className="flex flex-col space-y-4 items-center justify-center">
        <TransitionWrapper>
          <canvas
            ref={canvasRef}
            id="divination-canvas"
            width={400}
            height={400}
            className="border border-neutral-200 bg-white rounded-xl shadow-md"
          />
        </TransitionWrapper>

        <div className="flex gap-4">
          <Button type="button" onClick={handleGenerateHexagram}>
            Generate Hexagram
          </Button>
          <Button type="button" onClick={handleReset}>
            Reset
          </Button>
        </div>
      </div>
    </div>
  )
}
