import { changingLineDescriptions } from '@/app/oracle/library'
import { DivinationQuestion, DivinationResult } from '@/app/oracle/types'

export async function getInterpretation(
  divinationQuestion: DivinationQuestion,
  result: DivinationResult
): Promise<string> {
  try {
    // Get changing lines with their descriptions
    const changingLinesData = result.changingLines
      .map((line, index) => {
        if (!line?.hasChanges) return null
        // Reverse the mapping: index 0 → Line 6 (top), index 5 → Line 1 (bottom)
        const lineNumber = 6 - index
        const descriptionIndex = 5 - index
        const direction = line.type === 'solid' ? 'Yang → Yin' : 'Yin → Yang'
        const description = changingLineDescriptions[result.hexagram1.number][descriptionIndex]
        return { lineNumber, direction, description }
      })
      .filter((line): line is NonNullable<typeof line> => line !== null)

    const response = await fetch('/api/interpret-reading', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: divinationQuestion.question,
        context: divinationQuestion.context,
        presentHexagram: {
          number: result.hexagram1.number,
          name: result.hexagram1.name,
          hexagram: result.hexagram1.hexagram,
        },
        futureHexagram: {
          number: result.hexagram2.number,
          name: result.hexagram2.name,
          hexagram: result.hexagram2.hexagram,
        },
        changingLines: changingLinesData,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to get interpretation')
    }

    const data = await response.json()
    return data.interpretation
  } catch (error) {
    console.error('Error getting interpretation:', error)
    return 'Unable to generate interpretation at this time. Please try again.'
  }
}
