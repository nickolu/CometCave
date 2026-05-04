// OpenAI-backed judge for trivia questions. Scores two dimensions the
// pipeline cares most about: factual accuracy and difficulty calibration.
// Deliberately uses an OpenAI model so the judge isn't grading the
// Anthropic generator's own output.
//
// Uses the openai SDK's native structured-output helper (zodResponseFormat)
// instead of the @ai-sdk/openai generateObject wrapper — the latter
// rejects parsed responses on a regular cadence with "response did not
// match schema" even when OpenAI's JSON schema mode is correct, and it
// hides the raw response when it does. Going direct gives us reliability
// + the raw text when something does go wrong.
//
// Override the model with OPENAI_EVAL_MODEL. Default is gpt-4o (full,
// not -mini — judging needs better reasoning than the daily fallback).

import { OpenAI } from 'openai'
import { zodResponseFormat } from 'openai/helpers/zod'
import { z } from 'zod'

import { recordUsage } from '../../src/lib/trivia/usageRecorder'
import type { Difficulty } from './golden-cells'

const JUDGE_MODEL = process.env.OPENAI_EVAL_MODEL ?? 'gpt-4o'

// All fields are required and use only types OpenAI's structured-output
// mode supports (number, string, boolean) — no .int(), no .min/.max
// constraints (those become JSON Schema keywords OpenAI's strict mode
// doesn't always honor and that the SDK then rejects post-hoc). We
// validate the integer/range invariants ourselves below.
const VerdictSchema = z.object({
  factual_score: z
    .number()
    .describe('Integer 1, 2, or 3. 1=wrong, 2=minor issue, 3=correct.'),
  factual_rationale: z
    .string()
    .describe('One sentence on why you scored factual accuracy this way.'),
  difficulty_score: z
    .number()
    .describe(
      'Integer 1, 2, or 3. 1=clearly mismatched, 2=borderline, 3=well-calibrated.'
    ),
  difficulty_rationale: z
    .string()
    .describe('One sentence on why you scored difficulty this way.'),
  ship: z
    .boolean()
    .describe(
      'true only if both scores are 3, OR (one is 3 and the other is 2). Anything with a 1 must not ship.'
    ),
})

export type Verdict = z.infer<typeof VerdictSchema>

const DIFFICULTY_DEFINITIONS = `
- easy: Casual party-trivia bar. The correct answer must be a string a typical adult (no special interest in the topic) would naturally type — household names, common short answers. Specialist labels for famous things ("Atomic Bomb Dome" instead of "Hiroshima"), regnal forms ("Constantine the Great" vs "Constantine"), or fragile multi-word strings ("Lifetime Achievement Grammy Award" vs "Lifetime Achievement Award") FAIL the easy bar.
- medium: Beyond common knowledge but in reach for someone who follows the category casually. Not deep cuts.
- hard: Genuine deep cuts. Real specific knowledge of the topic — challenging but fair. A "hard" question whose answer a child would know is mis-tiered.
`.trim()

export interface JudgeInput {
  question: string
  correctAnswer: string
  explanation: string
  category: string
  difficulty: Difficulty
  sourceUrl?: string
}

export async function judgeQuestion(input: JudgeInput): Promise<Verdict> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not set')

  const client = new OpenAI({ apiKey })

  const completion = await client.chat.completions.parse({
    model: JUDGE_MODEL,
    temperature: 0,
    max_tokens: 500,
    response_format: zodResponseFormat(VerdictSchema, 'verdict'),
    messages: [
      {
        role: 'system',
        content:
          'You are a strict reviewer for a casual trivia game. You evaluate two dimensions only: factual accuracy of the question, and whether its difficulty is calibrated to the stated tier. Be strict — if you have meaningful doubt about the answer being correct, score it down. Do not be lenient because the question "feels well-written."',
      },
      {
        role: 'user',
        content: `Evaluate this trivia question.

Question: ${input.question}
Stated correct answer: ${input.correctAnswer}
Explanation shown to the player after answering: ${input.explanation}
Category: ${input.category}
Target difficulty: ${input.difficulty.toUpperCase()}
${input.sourceUrl ? `Source URL the generator used: ${input.sourceUrl}` : ''}

DIFFICULTY DEFINITIONS:
${DIFFICULTY_DEFINITIONS}

Score each dimension 1–3:

FACTUAL ACCURACY
  3 — The premise of the question is correct AND the stated correct answer is correct AND no other answer is more correct.
  2 — The answer is broadly right but there is a minor issue: a date/number is slightly off, framing is mildly misleading, OR another answer is also defensible.
  1 — The stated correct answer is wrong, the premise is wrong, or the question is unanswerable as posed.

DIFFICULTY CALIBRATION
  3 — Clearly fits the target difficulty per the definitions above.
  2 — Borderline — fits the difficulty for some players but not others, or sits between two tiers.
  1 — Clearly mismatched (e.g. an "easy" question whose stated correct answer is a specialist label, a "hard" question whose answer a casual player would know).

Set ship=true only if BOTH scores are 3, OR one is 3 and the other is 2. Anything with a 1 must not ship.

Provide a one-sentence rationale for each score.`,
      },
    ],
  })
  recordUsage({
    stage: 'judge',
    model: JUDGE_MODEL,
    inputTokens: completion.usage?.prompt_tokens ?? 0,
    outputTokens: completion.usage?.completion_tokens ?? 0,
  })

  const parsed = completion.choices[0]?.message.parsed
  if (!parsed) {
    const refusal = completion.choices[0]?.message.refusal
    throw new Error(
      `Judge returned no parsed object${refusal ? ` (refusal: ${refusal})` : ''}`
    )
  }

  // Belt-and-braces: the schema permits any number, but we treat 1/2/3
  // as the only valid scores. Clamp + round so a stray "2.5" doesn't
  // poison aggregation downstream.
  const fScore = clampScore(parsed.factual_score)
  const dScore = clampScore(parsed.difficulty_score)

  return {
    factual_score: fScore,
    factual_rationale: parsed.factual_rationale,
    difficulty_score: dScore,
    difficulty_rationale: parsed.difficulty_rationale,
    ship: parsed.ship,
  }
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 2
  const r = Math.round(n)
  if (r < 1) return 1
  if (r > 3) return 3
  return r
}

export const JUDGE_MODEL_ID = JUDGE_MODEL
