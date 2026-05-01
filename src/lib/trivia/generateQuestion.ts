import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { z } from 'zod'

import {
  CATEGORIZED_SEEDS,
  MODIFIERS,
  getOpenTDBCategoryName,
} from '@/app/trivia/data/seeds'
import type { AIQuestion } from '@/lib/trivia/aiQuestions'
import {
  type Fact,
  type FactSource,
  getDefaultFactSource,
} from '@/lib/trivia/factSources'

export type GeneratedQuestion = Omit<
  AIQuestion,
  'status' | 'timesShown' | 'timesCorrect' | 'avgTimeMs' | 'likeCount' | 'dislikeCount'
>

export interface GenerateInfiniteQuestionOptions {
  difficulty?: 'easy' | 'medium' | 'hard'
  categoryId?: number
  streak?: number
  // Override for tests / future per-category source routing. Falls
  // back to getDefaultFactSource() when omitted.
  factSource?: FactSource
}

// Question construction needs to satisfy multiple constraints at once
// (specific, leak-free, category-bound). gpt-4o-mini was repeatedly
// oscillating between the constraints — fixing a leak would introduce
// ambiguity, repairing the ambiguity would re-introduce the leak. Use
// the full gpt-4o for construction and repair where instruction-
// following matters; keep mini for the cheaper fact extraction and
// reviewer stages.
const QUESTION_MODEL = 'gpt-4o'
const REPAIR_MODEL = 'gpt-4o'
const REVIEW_MODEL = 'gpt-4o-mini'
const FACTS_PER_FETCH = 5
const MAX_GENERATION_ATTEMPTS = 3
const MAX_REPAIRS_PER_DRAFT = 2

const DIFFICULTY_GUIDANCE: Record<'easy' | 'medium' | 'hard', string> = {
  easy: 'Should be approachable — a well-known fact that many people could answer correctly.',
  medium:
    'Should require some specific knowledge — harder than common knowledge but not obscure trivia.',
  hard: 'Should require real, specific knowledge of the topic — challenging but fair.',
}

function streakBiasedDifficulty(streak: number): 'easy' | 'medium' | 'hard' {
  let weights: [number, number, number]
  if (streak >= 20) weights = [0.05, 0.25, 0.7]
  else if (streak >= 10) weights = [0.1, 0.3, 0.6]
  else if (streak >= 5) weights = [0.3, 0.4, 0.3]
  else weights = [0.6, 0.3, 0.1]

  const r = Math.random()
  if (r < weights[0]) return 'easy'
  if (r < weights[0] + weights[1]) return 'medium'
  return 'hard'
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function pickCategoryId(): number {
  const ids = Object.keys(CATEGORIZED_SEEDS).map(Number)
  return pickRandom(ids)
}

const QuestionSchema = z.object({
  question: z
    .string()
    .describe('The trivia question text, ending with a question mark.'),
  correct_answer: z
    .string()
    .describe(
      'The exact correct answer. Must equal the fact\'s keyDetail (or a close, unambiguous variant — e.g. "1986" instead of "February 21, 1986" if the question asks for the year).'
    ),
  explanation: z
    .string()
    .describe(
      '2-3 sentences explaining the answer and why it is interesting. May elaborate beyond the fact.'
    ),
})

const ReviewSchema = z.object({
  accept: z
    .boolean()
    .describe('Whether the question meets the quality bar described in the prompt.'),
  inferred_category: z
    .string()
    .describe('The single category from the provided list this question best belongs to.'),
  rejection_reason: z
    .string()
    .nullable()
    .describe('Brief explanation if rejected, otherwise null.'),
})

const KNOWN_CATEGORIES = [
  'General Knowledge',
  'Books',
  'Film',
  'Music',
  'Musicals & Theatre',
  'Television',
  'Video Games',
  'Board Games',
  'Science & Nature',
  'Computers',
  'Mathematics',
  'Mythology',
  'Sports',
  'Geography',
  'History',
  'Politics',
  'Art',
  'Celebrities',
  'Animals',
  'Vehicles',
  'Comics',
  'Gadgets',
  'Anime & Manga',
  'Cartoons & Animation',
] as const

interface DraftQuestion {
  question: string
  correct_answer: string
  explanation: string
  difficulty: 'easy' | 'medium' | 'hard'
  categoryName: string
  fact: Fact
  seedSummary: string
}

async function constructQuestionFromFact(
  apiKey: string,
  fact: Fact,
  ctx: {
    categoryName: string
    difficulty: 'easy' | 'medium' | 'hard'
    seedSummary: string
  }
): Promise<DraftQuestion> {
  const openaiClient = createOpenAI({ apiKey })

  const result = await generateObject({
    model: openaiClient(QUESTION_MODEL),
    schema: QuestionSchema,
    system:
      'You are a trivia question writer for a cosmic-cave-themed game. You receive a verified fact and turn it into a single short trivia question that asks for the fact\'s keyDetail. You never invent details; you only ask about what the fact already states.',
    prompt: `Build a ${ctx.difficulty} trivia question from this fact.

Fact: ${fact.claim}
Answer (keyDetail): ${fact.keyDetail}
Category: ${ctx.categoryName}

Difficulty: ${ctx.difficulty.toUpperCase()}. ${DIFFICULTY_GUIDANCE[ctx.difficulty]}

Rules:
- The question MUST have ONE unambiguous correct answer. If a knowledgeable person could plausibly give a different answer than the keyDetail, you must add identifying details to the question that rule out the alternatives. Do not write a question whose answer is "any X that fits Y" when many X fit Y.
- The question must ask specifically for the keyDetail.
- The question must NOT contain the keyDetail or a synonym/translation of it.
- The correct_answer must equal the keyDetail or a clear variant (e.g. "1986" if the keyDetail is "February 21, 1986" and the question asks for the year).
- The explanation may elaborate beyond the fact (2-3 sentences).
- Stay in the "${ctx.categoryName}" category. Do not drift.
- Free-text answer; this is NOT a multiple-choice question.

Examples:

GOOD: fact="Serena Williams won her 23rd and final Grand Slam singles title at the 2017 Australian Open." keyDetail="2017 Australian Open"
  Question: "At which Grand Slam tournament did Serena Williams win her 23rd and final singles title?"
  → unambiguous AND the question doesn't contain "2017" or "Australian Open."

AMBIGUITY BAD: same fact, keyDetail="2017 Australian Open"
  Question: "At which Grand Slam did Serena Williams win a major title?"
  → ambiguous; she won several. Specify "her 23rd / final" to rule out alternatives.

LEAK BAD: same fact, keyDetail="2017 Australian Open"
  Question: "When did Serena Williams win at the 2017 Australian Open?"
  → the keyDetail "2017 Australian Open" is right there in the question. Players answering this question would just type the words they already see.

LEAK BAD: fact="The Pythagorean theorem states that a² + b² = c² for any right triangle." keyDetail="Pythagorean theorem"
  Question: "What is the Pythagorean theorem?"
  → keyDetail appears in the question. To fix, describe the theorem without naming it:
  Better: "What theorem describes the relationship a² + b² = c² between the sides of a right triangle?"

A useful test: if you removed the keyDetail (and obvious synonyms) from your question, would the question still make sense and ask for that specific answer? If not, you have leaked the answer. Reword so the question describes the answer rather than naming it.

If you cannot construct a question that is both unambiguous AND leak-free from this fact, output the best-effort question you can — the reviewer will reject and we will retry with a different fact.`,
    temperature: 0.5,
    maxTokens: 400,
  })

  if (!result.object.question || !result.object.correct_answer) {
    throw new Error('Question construction returned empty fields')
  }

  return {
    question: result.object.question,
    correct_answer: result.object.correct_answer,
    explanation: result.object.explanation,
    difficulty: ctx.difficulty,
    categoryName: ctx.categoryName,
    fact,
    seedSummary: ctx.seedSummary,
  }
}

interface ReviewResult {
  accept: boolean
  reason: string | null
  inferred_category: string
}

// Targeted repair pass: given a draft that the reviewer rejected, ask
// the LLM to fix the SAME fact's question using the rejection reason as
// guidance. Cheaper than throwing the draft away (which costs a fresh
// fact extraction + construction), and tends to converge because the
// reviewer's rejection is concrete and actionable.
async function repairDraft(
  apiKey: string,
  draft: DraftQuestion,
  rejectionReason: string
): Promise<DraftQuestion> {
  const openaiClient = createOpenAI({ apiKey })

  const result = await generateObject({
    model: openaiClient(REPAIR_MODEL),
    schema: QuestionSchema,
    system:
      'You are a trivia question writer fixing a previous draft that a reviewer rejected. You receive the original fact, the rejected draft, and the rejection reason. Produce a revised question that resolves the specific issue while staying faithful to the fact.',
    prompt: `A reviewer rejected the following draft trivia question. Produce a revised version that resolves the rejection.

Source fact: ${draft.fact.claim}
Answer (keyDetail): ${draft.fact.keyDetail}
Category: ${draft.categoryName}
Difficulty: ${draft.difficulty.toUpperCase()}

Rejected question: ${draft.question}
Rejected correct_answer: ${draft.correct_answer}
Rejected explanation: ${draft.explanation}

Reviewer's rejection reason: ${rejectionReason}

Rules for the fix:
- Keep the SAME fact and the SAME keyDetail as the answer. Do not switch facts.
- Address the rejection reason directly — if the reviewer said the answer was leaked, reword so the question describes the answer rather than naming it. If the reviewer said the answer was ambiguous, add identifying details that rule out alternatives.
- The revised question must NOT contain the keyDetail or any obvious synonym of it.
- The revised question must have ONE unambiguous correct answer.
- Stay in the "${draft.categoryName}" category.
- Free-text answer (not multiple choice).

Output the revised question, the correct_answer (still equivalent to the keyDetail), and an explanation. If you genuinely cannot fix this fact's question without changing the answer, output your best attempt — we will fall through to a fresh fact.`,
    temperature: 0.4,
    maxTokens: 400,
  })

  if (!result.object.question || !result.object.correct_answer) {
    throw new Error('Repair returned empty fields')
  }

  return {
    ...draft,
    question: result.object.question,
    correct_answer: result.object.correct_answer,
    explanation: result.object.explanation,
  }
}

// Cheap, deterministic pre-check that catches the most common reviewer-
// rejection reason: the keyDetail is echoed verbatim inside the question
// text. Saves a reviewer call when we can already tell the draft will
// fail. Doesn't catch synonym leaks (the reviewer still does that), but
// catches the easy half of the failure mode.
export function detectAnswerLeak(question: string, keyDetail: string): boolean {
  const q = question.toLowerCase()
  const k = keyDetail.toLowerCase().trim()
  if (k.length < 3) return false

  // Verbatim full-string match.
  if (q.includes(k)) return true

  // Adjacent significant-word pairs. A multi-word keyDetail like
  // "2017 Australian Open" leaks if the question contains "Australian
  // Open" even without the year. Checking every adjacent pair of
  // longer-than-3-char words catches that case without false-positiving
  // on common short words like "of" or "the".
  const words = k.split(/\s+/).filter((w) => w.length > 0)
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i].length > 3 && words[i + 1].length > 3) {
      const pair = `${words[i]} ${words[i + 1]}`
      if (q.includes(pair)) return true
    }
  }
  return false
}

async function reviewQuestion(
  apiKey: string,
  draft: DraftQuestion
): Promise<ReviewResult> {
  const openaiClient = createOpenAI({ apiKey })

  const result = await generateObject({
    model: openaiClient(REVIEW_MODEL),
    schema: ReviewSchema,
    system:
      'You are a quality reviewer for trivia questions. Your job is to catch GENUINE problems, not to second-guess perfectly-good descriptive questions. A great trivia question describes its answer without naming it — that is the whole point of trivia.',
    prompt: `Review this trivia question for the category "${draft.categoryName}".

Source fact: ${draft.fact.claim}
Question: ${draft.question}
Expected answer: ${draft.correct_answer}
Explanation: ${draft.explanation}

A question is a LEAK only if the expected answer string (or a clear synonym/translation of it) appears in the question text. Describing the answer is NOT a leak — it's good trivia.

LEAK examples (REJECT):
  Question: "What is the Pythagorean theorem?" Answer: "Pythagorean theorem"
    → "Pythagorean theorem" appears verbatim. Leak.
  Question: "When did the Lincoln Futura concept car appear in the 1966 Batman series?" Answer: "Lincoln Futura"
    → "Lincoln Futura" appears verbatim. Leak.

NOT-A-LEAK examples (ACCEPT, do not flag as leak):
  Question: "Which early arcade video game, released by Atari in 1972, simulated table tennis?" Answer: "Pong"
    → "Pong" does not appear. The question describes Pong via its features. ACCEPT.
  Question: "How many novels are in Terry Pratchett's Discworld series?" Answer: "41"
    → "41" does not appear. The word "novels" is in the question, but that's the unit, not the answer. ACCEPT.
  Question: "What 2019 anthology explores the worldbuilding of Robert Jordan's Wheel of Time series?" Answer: "The World of the Wheel of Time"
    → The phrase "Wheel of Time" appears in the question, but it refers to the SERIES being described, not the ANTHOLOGY. The answer (the anthology title) does not appear as the answer. ACCEPT.

Then check the OTHER failure modes:
- The question has multiple equally-valid answers (must have ONE specific answer).
- The question is too vague to answer without options.
- The question is nonsensical or contradicts itself.
- The "expected answer" doesn't actually answer the question.
- The question's claim contradicts the source fact, or the answer doesn't match what the fact supports.
- The question doesn't belong to category "${draft.categoryName}" — pick the best fit from: ${KNOWN_CATEGORIES.join(', ')}

Set accept=true if all checks pass. If you reject, give a one-sentence rejection_reason naming the specific failure. inferred_category is the category you think the question best belongs to.`,
    temperature: 0,
    maxTokens: 200,
  })

  // Trust the LLM's overall accept signal. We previously also required
  // inferred_category === draft.categoryName exactly, but that produced
  // false rejections for near-matches ("Pop Music" vs "Music") and the
  // construction prompt already enforces category fidelity upstream.
  // Keep inferred_category in the return for telemetry.
  return {
    accept: result.object.accept,
    reason: result.object.rejection_reason,
    inferred_category: result.object.inferred_category,
  }
}

/**
 * Generate a single trivia question on the fly for Infinite Trivia.
 *
 * Pipeline:
 *
 *   1. Fact extraction — call the configured FactSource (LLM-only
 *      today; Wikipedia / Perplexity planned) to surface candidate
 *      facts about the chosen category + seed.
 *   2. Question construction (gpt-4o-mini, temp 0.5) — pick a fact
 *      and turn it into a question whose answer is the fact's
 *      keyDetail.
 *   3. Inner repair loop:
 *      a. Deterministic pre-check (detectAnswerLeak) for verbatim
 *         keyDetail leaks — fast-fails before a reviewer call.
 *      b. Quality review (gpt-4o-mini, temp 0) — strict reviewer.
 *      c. If rejected, call repairDraft with the rejection reason
 *         as targeted feedback. Up to MAX_REPAIRS_PER_DRAFT repairs
 *         per draft before falling through to a fresh fact.
 *   4. Outer retry: up to MAX_GENERATION_ATTEMPTS fresh fact extractions.
 *
 * Repair is cheaper than blind retry because it preserves the (already
 * vetted) fact and uses the reviewer's specific complaint to guide the
 * fix. Most rejections converge on the first repair pass.
 *
 * On total failure the /next route maps the throw to a 204.
 *
 * The FactSource interface lets us migrate to grounded sources
 * (Wikipedia, Wikidata, Perplexity) without touching construction,
 * repair, or review stages.
 */
export async function generateInfiniteQuestion(
  options: GenerateInfiniteQuestionOptions = {}
): Promise<GeneratedQuestion> {
  const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OpenAI API key not configured')

  const factSource = options.factSource ?? getDefaultFactSource()

  let lastReason = 'unknown'
  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
    const difficulty = options.difficulty ?? streakBiasedDifficulty(options.streak ?? 0)
    const categoryId = options.categoryId ?? pickCategoryId()
    const categoryName = getOpenTDBCategoryName(categoryId)
    const seeds = CATEGORIZED_SEEDS[categoryId] ?? CATEGORIZED_SEEDS[9]
    const seedWord = pickRandom(seeds)
    const modifier = pickRandom(MODIFIERS)
    const seedSummary = `${seedWord} :: ${modifier}`

    let facts: Fact[]
    try {
      facts = await factSource.fetchFacts({
        categoryId,
        category: categoryName,
        seed: seedSummary,
        difficulty,
        count: FACTS_PER_FETCH,
      })
    } catch (err) {
      lastReason = `factSource(${factSource.id}) failed: ${err instanceof Error ? err.message : String(err)}`
      console.warn('[generateInfiniteQuestion] fact fetch failed', { attempt, reason: lastReason })
      continue
    }

    if (facts.length === 0) {
      lastReason = `factSource(${factSource.id}) returned 0 facts`
      console.warn('[generateInfiniteQuestion] no facts', { attempt, category: categoryName })
      continue
    }

    const fact = pickRandom(facts)
    let draft = await constructQuestionFromFact(apiKey, fact, {
      categoryName,
      difficulty,
      seedSummary,
    })

    // Inner repair loop: try to fix this draft up to MAX_REPAIRS_PER_DRAFT
    // times before falling through to a fresh outer attempt.
    let acceptedDraft: DraftQuestion | null = null
    let acceptedReview: ReviewResult | null = null

    for (let repair = 0; repair <= MAX_REPAIRS_PER_DRAFT; repair++) {
      // Deterministic pre-check: if the question echoes the keyDetail
      // verbatim, attempt repair without paying for a reviewer call.
      if (detectAnswerLeak(draft.question, fact.keyDetail)) {
        const reason = `Question contains the answer "${fact.keyDetail}" verbatim. Reword so the question describes the answer rather than naming it.`
        lastReason = `pre-check leak: ${reason}`
        console.warn('[generateInfiniteQuestion] draft rejected (pre-check)', {
          attempt,
          repair,
          category: categoryName,
          keyDetail: fact.keyDetail,
          question: draft.question,
        })
        if (repair < MAX_REPAIRS_PER_DRAFT) {
          try {
            draft = await repairDraft(apiKey, draft, reason)
          } catch (err) {
            lastReason = `repair failed: ${err instanceof Error ? err.message : String(err)}`
            console.warn('[generateInfiniteQuestion] repair threw', { attempt, repair, reason: lastReason })
            break
          }
          continue
        }
        break
      }

      const review = await reviewQuestion(apiKey, draft)
      if (review.accept) {
        acceptedDraft = draft
        acceptedReview = review
        break
      }

      lastReason = review.reason ?? `inferred=${review.inferred_category}`
      console.warn('[generateInfiniteQuestion] draft rejected', {
        attempt,
        repair,
        category: categoryName,
        seed: seedSummary,
        factSource: factSource.id,
        factSourceCitation: fact.source,
        reason: lastReason,
        keyDetail: fact.keyDetail,
        question: draft.question,
      })

      if (repair < MAX_REPAIRS_PER_DRAFT) {
        try {
          draft = await repairDraft(apiKey, draft, lastReason)
        } catch (err) {
          lastReason = `repair failed: ${err instanceof Error ? err.message : String(err)}`
          console.warn('[generateInfiniteQuestion] repair threw', { attempt, repair, reason: lastReason })
          break
        }
        continue
      }
      break
    }

    if (acceptedDraft && acceptedReview) {
      const id = `ai-infinite-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      console.info('[generateInfiniteQuestion] generated', {
        id,
        category: categoryName,
        difficulty,
        attempt,
        factSource: factSource.id,
        factSourceCitation: fact.source,
        inferredCategory: acceptedReview.inferred_category,
      })
      return {
        id,
        question: acceptedDraft.question,
        correctAnswer: acceptedDraft.correct_answer,
        explanation: acceptedDraft.explanation,
        category: categoryName,
        difficulty,
        type: 'free-text',
      }
    }
  }

  throw new Error(
    `Generation failed quality gate after ${MAX_GENERATION_ATTEMPTS} attempts: ${lastReason}`
  )
}
