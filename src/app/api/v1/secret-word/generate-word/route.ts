import { type NextRequest, NextResponse } from 'next/server'
import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { z } from 'zod'

const SecretWordSchema = z.object({
  word: z.string().describe('A creative, challenging secret word for the AI to use'),
  difficulty: z.enum(['easy', 'medium', 'hard']).describe('The difficulty level of the word'),
  category: z
    .string()
    .describe('The category this word belongs to (e.g., animal, object, concept)'),
  hint: z.string().describe('A subtle hint about the word without giving it away'),
})

const categories = [
  'animal',
  'object',
  'concept',
  'nature',
  'technology',
  'food',
  'activity',
  'emotion',
  'place',
  'color',
  'shape',
  'mythology',
  'history',
  'science',
  'art',
  'music',
  'literature',
  'philosophy',
  'religion',
  'name',
  'language',
  'currency',
  'sport',
  'game',
  'vehicle',
  'weapon',
  'location',
]

export async function POST(request: NextRequest) {
  try {
    // Get API key from environment variable or request header
    let apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY
    const headerApiKey = request.headers.get('x-openai-api-key')

    if (headerApiKey) {
      apiKey = headerApiKey
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured. Please provide an API key.' },
        { status: 500 }
      )
    }

    const { avoidWords = [] } = await request.json()

    // Create list of words to avoid
    const avoidWordsText =
      Array.isArray(avoidWords) && avoidWords.length > 0
        ? `\n\nAvoid these words that have been used recently: ${avoidWords.join(', ')}`
        : ''

    const wordUsage = [
      'extremely commonly',
      'very commonly',
      'commonly',
      'regularly',
      'somewhat regularly',
    ]
    const randomUsage = wordUsage[Math.floor(Math.random() * wordUsage.length)]

    const randomCategory = categories[Math.floor(Math.random() * categories.length)]
    const prompt = `Generate a creative secret word for the AI to use in a Secret Word game.

REQUIREMENTS:
- The word should be used ${randomUsage} in everyday conversation
- Choose a word from the following random category: ${randomCategory}
- It should be a single word (no phrases or compound words with spaces)
- It should be appropriate for all ages
- Avoid these words: ${avoidWordsText}

Select a word that will make for an engaging game where the player has a fair chance of guessing it through strategic questions.`

    const openaiClient = createOpenAI({
      apiKey,
    })

    const result = await generateObject({
      model: openaiClient('gpt-4o-mini'),
      schema: SecretWordSchema,
      prompt,
      temperature: 0.9, // Higher temperature for more variety in word selection
      maxTokens: 150,
    })

    return NextResponse.json({
      word: result.object.word,
      difficulty: result.object.difficulty,
      category: result.object.category,
      hint: result.object.hint,
    })
  } catch (error) {
    console.error('Error generating secret word:', error)

    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'OpenAI API key is invalid or missing. Please check your API key.' },
          { status: 401 }
        )
      }
      if (error.message.includes('quota')) {
        return NextResponse.json(
          { error: 'OpenAI API quota exceeded. Please check your OpenAI account.' },
          { status: 429 }
        )
      }
    }

    // Fallback to a random word from a predefined list
    const fallbackWords = {
      easy: ['cat', 'dog', 'house', 'tree', 'happy', 'blue', 'sun', 'book'],
      medium: [
        'butterfly',
        'adventure',
        'wisdom',
        'castle',
        'thunder',
        'crystal',
        'rainbow',
        'treasure',
      ],
      hard: [
        'serenity',
        'enigma',
        'constellation',
        'metamorphosis',
        'philosophical',
        'extraordinary',
        'magnificent',
        'incomprehensible',
      ],
    }

    const difficulty = 'medium'
    const wordList = fallbackWords[difficulty as keyof typeof fallbackWords] || fallbackWords.medium
    const randomWord = wordList[Math.floor(Math.random() * wordList.length)]

    return NextResponse.json({
      word: randomWord,
      difficulty,
      category: 'fallback',
      hint: 'AI-generated word',
    })
  }
}
