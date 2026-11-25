/**
 * Blanks — writing the story template on the server.
 *
 * One model call per story. The model writes a short, silly, all-ages story
 * about the player's topic with a marker wherever a word is missing, the hint
 * inside it: `{{plural noun}}`. `parseTemplate` checks the result; a malformed
 * one is tried once more with the problem spelled out before giving up.
 *
 * Only the route should import this. The client never sees the prompt.
 */
import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { z } from 'zod'

import { type RawTemplate, type StoryTemplate, parseTemplate } from './story'

const TemplateSchema = z.object({
  title: z.string().describe('A short, funny title for the story. Up to eight words.'),
  story: z
    .string()
    .describe(
      'The story, 120 to 170 words of plain prose in two or three paragraphs separated by a blank line. Every missing word is a marker holding its word type, like {{adjective}}, {{plural noun}}, {{verb ending in -ing}}, {{a type of food}}. No markdown.'
    ),
})

const BLANK_COUNT = { min: 10, max: 14 }

function buildPrompt(topic: string, problem?: string): string {
  const subject = topic
    ? `The topic is: "${topic}".`
    : 'Pick any everyday situation and make it absurd.'
  return `You write fill-in-the-blank stories, the kind where players give words before they read the story and the result is ridiculous.

${subject}

Write one story.

Rules:
- 120 to 170 words, two or three short paragraphs separated by a blank line.
- Leave ${BLANK_COUNT.min} to ${BLANK_COUNT.max} words out. Where a word is missing, write a marker with the type of word that belongs there inside double curly braces: {{adjective}}, {{plural noun}}, {{verb}}, {{verb ending in -ing}}, {{exclamation}}, {{a number}}, {{a body part}}, {{a type of food}}, {{an animal}}, {{a place}}, {{a famous person}}, {{a silly sound}}.
- The marker holds only the word type, never the word itself and never a number. Three to five words at most.
- Spread the blanks through the whole story. Never put two markers next to each other, and mix the word types.
- Choose blanks where almost any word of that type will be funny, and make sure the sentence around each blank still reads naturally whatever word goes in.
- Keep the fixed words warm and specific, with real jokes in them, so the story is fun even before the blanks.
- All ages. No violence, romance, insults, bathroom humor, scary content, or brand names. If the topic is unsuitable for children, write about a harmless neighbour of the topic instead and say nothing about the swap.
- Do not mention blanks, players, or games inside the story. No markdown, no headings, no quotes around the title.${
    problem ? `\n\nYour previous attempt was rejected: ${problem} Fix that this time.` : ''
  }`
}

export class StoryGenerationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StoryGenerationError'
  }
}

export async function generateBlanksStory(topic: string): Promise<StoryTemplate> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new StoryGenerationError('OPENAI_API_KEY is not configured')
  const openai = createOpenAI({ apiKey })

  let problem: string | undefined
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: TemplateSchema,
      prompt: buildPrompt(topic, problem),
      temperature: 0.9,
      maxTokens: 900,
    })
    const raw: RawTemplate = result.object
    const template = parseTemplate(raw)
    if (template) return template
    problem = describeProblem(raw)
    console.warn('[blanks] template rejected', { attempt, problem })
    if (process.env.BLANKS_DEBUG) console.warn(JSON.stringify(raw, null, 1))
  }
  throw new StoryGenerationError('The model did not produce a usable template')
}

/** Say what went wrong in words the retry prompt can use. */
function describeProblem(raw: RawTemplate): string {
  const story = raw.story ?? ''
  const markers = [...story.matchAll(/\{\{([^{}]*)\}\}/g)].map(m => m[1].trim())
  if (markers.length < BLANK_COUNT.min) {
    return `only ${markers.length} {{…}} markers; leave out at least ${BLANK_COUNT.min} words.`
  }
  if (markers.length > BLANK_COUNT.max) {
    return `${markers.length} {{…}} markers is too many; at most ${BLANK_COUNT.max}.`
  }
  if (markers.some(m => /^\d+$/.test(m))) {
    return 'the markers held numbers; each marker must hold the word type, like {{plural noun}}.'
  }
  if (markers.some(m => !m)) return 'a marker was empty; every {{…}} must hold a word type.'
  if (markers.some(m => m.length > 50))
    return 'a marker was too long; a word type is three to five words.'
  if (/[{}]/.test(story.replace(/\{\{[^{}]*\}\}/g, ''))) {
    return 'there were stray curly braces outside the {{…}} markers.'
  }
  return 'the result did not parse; follow the marker rules exactly.'
}
