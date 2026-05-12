// OpenAI-backed judge for trivia questions. Scores three dimensions:
// factual accuracy, difficulty calibration, and concision (redundant
// clue stacking). Each dimension is a separate LLM call with its own
// focused prompt — keeps each rubric tight and lets the model
// concentrate on one thing at a time.
//
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

// Per-dimension schemas. All fields required, only types OpenAI's
// structured-output mode supports (number, string) — no .int(), no
// .min/.max constraints. We clamp/round downstream.
const FactualSchema = z.object({
  score: z
    .number()
    .describe('Integer 1, 2, or 3. 1=wrong, 2=minor issue, 3=correct.'),
  rationale: z.string().describe('One sentence on why you scored this way.'),
})

const DifficultySchema = z.object({
  score: z
    .number()
    .describe(
      'Integer 1, 2, or 3. 1=clearly mismatched, 2=borderline, 3=well-calibrated.'
    ),
  rationale: z.string().describe('One sentence on why you scored this way.'),
})

const ConcisionSchema = z.object({
  score: z
    .number()
    .describe(
      'Integer 1, 2, or 3. 1=piles on redundant identifying clues that trivialize the question, 2=one extra clue that nudges easier than intended, 3=clean framing with no redundant identifiers.'
    ),
  rationale: z.string().describe('One sentence on why you scored this way.'),
})

export interface Verdict {
  factual_score: number
  factual_rationale: string
  difficulty_score: number
  difficulty_rationale: string
  concision_score: number
  concision_rationale: string
  ship: boolean
}

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

  const [factual, difficulty, concision] = await Promise.all([
    judgeFactual(client, input),
    judgeDifficulty(client, input),
    judgeConcision(client, input),
  ])

  // Recompute ship locally from the three scores. The rule: no 1s, and
  // at most one 2.
  const scores = [factual.score, difficulty.score, concision.score]
  const ship =
    scores.every((s) => s >= 2) && scores.filter((s) => s === 2).length <= 1

  return {
    factual_score: factual.score,
    factual_rationale: factual.rationale,
    difficulty_score: difficulty.score,
    difficulty_rationale: difficulty.rationale,
    concision_score: concision.score,
    concision_rationale: concision.rationale,
    ship,
  }
}

interface DimensionResult {
  score: number
  rationale: string
}

async function judgeFactual(
  client: OpenAI,
  input: JudgeInput
): Promise<DimensionResult> {
  return runDimensionCall({
    client,
    schema: FactualSchema,
    schemaName: 'factual_verdict',
    system:
      'You are a strict factual reviewer for a trivia game. You judge ONE thing only: whether the stated correct answer is actually correct given the question. Be strict — if you have meaningful doubt, score it down. Do not be lenient because the question "feels well-written."',
    user: `Evaluate the FACTUAL ACCURACY of this trivia question.

Question: ${input.question}
Stated correct answer: ${input.correctAnswer}
Explanation shown to the player after answering: ${input.explanation}
Category: ${input.category}
${input.sourceUrl ? `Source URL the generator used: ${input.sourceUrl}` : ''}

Score 1–3:
  3 — The premise of the question is correct AND the stated correct answer is correct AND no other answer is more correct.
  2 — The answer is broadly right but there is a minor issue: a date/number is slightly off, framing is mildly misleading, OR another answer is also defensible.
  1 — The stated correct answer is wrong, the premise is wrong, or the question is unanswerable as posed.

Provide a one-sentence rationale.`,
  })
}

async function judgeDifficulty(
  client: OpenAI,
  input: JudgeInput
): Promise<DimensionResult> {
  return runDimensionCall({
    client,
    schema: DifficultySchema,
    schemaName: 'difficulty_verdict',
    system:
      'You are a strict difficulty calibrator for a casual trivia game. You judge ONE thing only: whether the question fits its stated difficulty tier. You are NOT judging factual correctness or whether the question is well-written.',
    user: `Evaluate the DIFFICULTY CALIBRATION of this trivia question.

Question: ${input.question}
Stated correct answer: ${input.correctAnswer}
Category: ${input.category}
Target difficulty: ${input.difficulty.toUpperCase()}

DIFFICULTY DEFINITIONS:
${DIFFICULTY_DEFINITIONS}

Score 1–3:
  3 — Clearly fits the target difficulty per the definitions above.
  2 — Borderline — fits the difficulty for some players but not others, or sits between two tiers.
  1 — Clearly mismatched (e.g. an "easy" question whose stated correct answer is a specialist label, a "hard" question whose answer a casual player would know).

Provide a one-sentence rationale.`,
  })
}

async function judgeConcision(
  client: OpenAI,
  input: JudgeInput
): Promise<DimensionResult> {
  return runDimensionCall({
    client,
    schema: ConcisionSchema,
    schemaName: 'concision_verdict',
    system:
      'You are a strict reviewer for trivia question concision. You judge ONE thing only: whether the question over-specifies the answer with redundant identifying clues that trivialize it. You are NOT judging factual correctness or whether the question matches its stated difficulty tier.',
    user: `Evaluate the CONCISION of this trivia question — i.e. whether it stacks redundant identifying clues that trivialize the answer.

Question: ${input.question}
Stated correct answer: ${input.correctAnswer}
Category: ${input.category}

The question should pose ONE clean route to the answer. If multiple independent clues are stacked such that any one of them alone would let a casual player guess the answer, the question is over-specified — even if each clue is factually correct. Concision is judged INDEPENDENTLY of the target difficulty: a hard question stuffed with giveaway clues is still a concision failure. Examples of clue stacking: naming the country/era/region when the answer's distinguishing fact is already enough; appending "born in X, known for Y" when "known for Y" already pinpoints the person.

Score 1–3:
  3 — Clean framing. The question states what's needed to make the question fair and no more; no clue is redundant.
  2 — One extra identifying clue that nudges the question easier than intended, but the question still has some bite.
  1 — Stacks multiple redundant identifying clues that trivialize the answer (e.g. "Which Asian country, home to the Great Wall and the world's largest population, ranks as the third-largest nation by area, behind only Russia and Canada?" — the area fact alone is sufficient; the rest is giveaway).

Provide a one-sentence rationale.`,
  })
}

async function runDimensionCall(args: {
  client: OpenAI
  schema: z.ZodTypeAny
  schemaName: string
  system: string
  user: string
}): Promise<DimensionResult> {
  const { client, schema, schemaName, system, user } = args

  const completion = await client.chat.completions.parse({
    model: JUDGE_MODEL,
    temperature: 0,
    max_tokens: 250,
    response_format: zodResponseFormat(schema, schemaName),
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  })

  recordUsage({
    stage: 'judge',
    model: JUDGE_MODEL,
    inputTokens: completion.usage?.prompt_tokens ?? 0,
    outputTokens: completion.usage?.completion_tokens ?? 0,
  })

  const parsed = completion.choices[0]?.message.parsed as
    | { score: number; rationale: string }
    | null
    | undefined
  if (!parsed) {
    const refusal = completion.choices[0]?.message.refusal
    throw new Error(
      `Judge (${schemaName}) returned no parsed object${refusal ? ` (refusal: ${refusal})` : ''}`
    )
  }

  return {
    score: clampScore(parsed.score),
    rationale: parsed.rationale,
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
