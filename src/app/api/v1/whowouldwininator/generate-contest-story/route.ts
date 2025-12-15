import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { NextResponse } from 'next/server'

import { READING_LEVEL } from '../constants'

export async function POST(request: Request) {
  try {
    const {
      candidate1Name,
      candidate1Description,
      candidate2Name,
      candidate2Description,
      battleScenario,
      contestResults,
    } = await request.json()

    const openaiClient = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    // Build scenario description
    const scenarioDescription =
      battleScenario.setting ||
      battleScenario.rules ||
      battleScenario.obstacles ||
      battleScenario.limitations ||
      battleScenario.additionalContext
        ? `Battle Scenario:
        Setting: ${battleScenario.setting || 'Open field with no obstacles'}
        Rules: ${battleScenario.rules || 'Standard combat, fight until one character is knocked out or unable to continue'}
        Obstacles: ${battleScenario.obstacles || 'None'}
        Limitations: ${battleScenario.limitations || 'None'}
        Additional Context: ${battleScenario.additionalContext || 'Both characters are at peak abilities from their respective canon'}`
        : `Battle Scenario: Standard TKO battle in an open field with both characters at peak abilities from their respective canon`

    // Build character profiles
    const candidate1Profile = `
Character 1: ${candidate1Name}
Description: ${candidate1Description}
    `

    const candidate2Profile = `
Character 2: ${candidate2Name}
Description: ${candidate2Description}
    `

    // Determine winner name for story consistency
    let winnerName = ''
    if (contestResults.winner === 'candidate1') {
      winnerName = candidate1Name
    } else if (contestResults.winner === 'candidate2') {
      winnerName = candidate2Name
    }

    const result = await generateText({
      model: openaiClient('gpt-4o-mini'),
      prompt: `Write a cinematic description of the battle/contest between these two characters. The story should be consistent with the predetermined outcome.

${candidate1Profile}

${candidate2Profile}

${scenarioDescription}

Contest Outcome:
- Winner: ${contestResults.winner === 'tie' ? 'Tie - both characters are evenly matched' : `${winnerName} wins`}
- Confidence: ${contestResults.confidence}/10
- Reasoning: ${contestResults.reasoning}

Instructions:
- Write a dramatic, cinematic story broken into three distinct sections
- Show both characters using their abilities and powers
- Make the story consistent with the predetermined outcome
- Include vivid action sequences and descriptions
- Build tension and excitement throughout
- Keep the tone exciting and engaging like a movie scene
- Keep the writing at a ${READING_LEVEL} reading level.

Structure your response EXACTLY as follows:

INTRO:
[Write the introduction/setup section - a few sentences describing the initial confrontation, setting the scene, and showing both characters preparing for battle]

CLIMAX:
[Write the climactic section - a few sentences showing the most intense moment of the battle, the decisive action, and the turning point]

ENDING:
[Write the conclusion - a few sentences showing the final outcome, aftermath, and resolution]

The story should be brief but engaging. Always start by drawing the reader in with an interesting hook. Keep the writing at a ${READING_LEVEL} reading level.`,
      temperature: 0.8, // Higher temperature for more creative storytelling
      maxTokens: 1200,
    })

    // Parse the structured response
    const storyText = result.text
    // Strip markdown formatting (bold text markers)
    const cleanedStoryText = storyText.replace(/\*\*/g, '')
    const introMatch = cleanedStoryText.match(/INTRO:\s*([\s\S]*?)\s*CLIMAX:/)
    const climaxMatch = cleanedStoryText.match(/CLIMAX:\s*([\s\S]*?)\s*ENDING:/)
    const endingMatch = cleanedStoryText.match(/ENDING:\s*([\s\S]*?)$/)

    const intro = introMatch?.[1]?.trim() || ''
    const climax = climaxMatch?.[1]?.trim() || ''
    const ending = endingMatch?.[1]?.trim() || ''

    // Combine all sections for the full story (backwards compatibility)
    const fullStory = `${intro}\n\n${climax}\n\n${ending}`

    return NextResponse.json({
      story: fullStory,
      intro,
      climax,
      ending,
    })
  } catch (error) {
    console.error('Error generating contest story:', error)
    return NextResponse.json({ error: 'Failed to generate contest story' }, { status: 500 })
  }
}
