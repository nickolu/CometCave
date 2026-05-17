import { createAnthropic } from '@ai-sdk/anthropic'
import { generateObject } from 'ai'
import { z } from 'zod'

import {
  CATEGORIZED_SEEDS,
  getOpenTDBCategoryName,
} from '@/app/trivia/data/seeds'
import { MODIFIERS_BY_DIFFICULTY } from '@/app/trivia/data/seeds/modifiersByDifficulty'
import { getSeedsForDifficulty } from '@/app/trivia/data/seedsByDifficulty'
import type { AIQuestion, QuestionGenerationModels } from '@/lib/trivia/aiQuestions'
import { findActiveDuplicateAnswer } from '@/lib/trivia/aiQuestions'
import {
  type Fact,
  type FactSource,
  getDefaultFactSource,
} from '@/lib/trivia/factSources'
import { recordUsage } from '@/lib/trivia/usageRecorder'
import { APP_VERSION } from '@/lib/version'

export type GeneratedQuestion = Omit<
  AIQuestion,
  'status' | 'timesShown' | 'timesCorrect' | 'avgTimeMs' | 'likeCount' | 'dislikeCount' | 'random'
>

export interface GenerateInfiniteQuestionOptions {
  difficulty?: 'easy' | 'medium' | 'hard'
  categoryId?: number
  streak?: number
  // When set, generate questions about this custom topic instead of a preset category.
  customCategory?: string
  // Override for tests / future per-category source routing. Falls
  // back to getDefaultFactSource() when omitted.
  factSource?: FactSource
}

// Construction and repair are the stages where reasoning matters most:
// the model has to satisfy multiple constraints at once (specific,
// leak-free, category-bound). Sonnet 4.6 handles this far better than
// gpt-4o, which oscillated between constraints. Review is a cheap
// deterministic-style pass — Haiku is enough.
//
// Note: Anthropic's extended-thinking mode is not enabled here because
// the AI SDK v4 Anthropic adapter requires forced tool use to validate
// against a Zod schema, and that path is incompatible with thinking.
// Sonnet 4.6 without thinking is still a clear quality upgrade.
const QUESTION_MODEL = 'claude-sonnet-4-6'
const REPAIR_MODEL = 'claude-sonnet-4-6'
const REVIEW_MODEL = 'claude-haiku-4-5-20251001'
const FACTS_PER_FETCH = 5
const MAX_GENERATION_ATTEMPTS = 3
const MAX_REPAIRS_PER_DRAFT = 2

const DIFFICULTY_GUIDANCE: Record<'easy' | 'medium' | 'hard', string> = {
  easy:
    'Casual party-trivia bar. Two strict rules:\n' +
    '1) The CORRECT ANSWER must be a name a typical adult would naturally produce — not a specialist label for a famous thing. If the fact\'s keyDetail is specialist (e.g. "Atomic Bomb Dome" for the Hiroshima memorial, "Genbaku Dome", "modal interchange" for the music idea, "Constantine the Great" when "Constantine" is what most people would type), the question is NOT easy as-is. Either repoint to ask about a more universally recognizable element of the same fact (e.g. "Which Japanese city was destroyed by the first wartime atomic bomb?" → "Hiroshima"), or skip this fact.\n' +
    '2) The correct answer must NOT be a fragile string-form (e.g. "Lifetime Achievement Grammy Award" when "Lifetime Achievement Award" is what a casual player would type). Prefer answers a casual player would type without overthinking.\n' +
    'Test: would 70%+ of casual players (no special interest in the topic) produce the exact correct_answer string from this question? If no, it\'s not easy.',
  medium:
    'Should require some specific knowledge — harder than common knowledge but still in reach for someone who follows the category casually. Not deep cuts.',
  hard: 'Should require real, specific knowledge of the topic — challenging but fair. Genuine deep cuts welcome here.',
}

// Difficulty mix for fresh generations. Fixed 4:2:1 (easy:medium:hard)
// — ~57% / ~29% / ~14% — regardless of streak. Mirrors the sampler's
// distribution; see getDifficultyWeights() in sampler.ts for the full
// rationale. The streak option is still accepted on
// GenerateInfiniteQuestionOptions so callers don't need to change.
function pickDifficulty(): 'easy' | 'medium' | 'hard' {
  const r = Math.random()
  if (r < 4 / 7) return 'easy'
  if (r < 6 / 7) return 'medium'
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
  const anthropicClient = createAnthropic({ apiKey })

  const result = await generateObject({
    model: anthropicClient(QUESTION_MODEL),
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
- The answer MUST be a NAMED entity (person, place, work, event, concept, organism, etc.) — never a number, year, date, percentage, or measurement on its own. If the keyDetail you've been given is a number/date/measurement, FLIP the question: ask about a named entity in the same fact and put the number INSIDE the question text as a discriminating clue. Adjust correct_answer to be that named entity. Specific numbers and dates are unfair as trivia answers — players have to guess. Use them as clues instead.
  Examples of the flip:
    "What is the depth of Lake Baikal?" → "1,642 meters" — BAD (guess-a-number)
    "Which Russian lake reaches a maximum depth of 1,642 meters, the deepest in the world?" → "Lake Baikal" — GOOD (the number anchors the question, the answer is a name)
    "What year did the Battle of Hastings happen?" → "1066" — BAD
    "Which 1066 battle marked the Norman conquest of England?" → "Battle of Hastings" — GOOD
    "How many novels are in the Discworld series?" → "41" — BAD
    "Which Terry Pratchett fantasy series consists of 41 novels?" → "Discworld" — GOOD
- The question must ask specifically for the keyDetail (or your repointed answer).
- The question must NOT contain the answer or a synonym/translation of it.
- The correct_answer must equal the keyDetail or a clear variant. EXCEPTION: for EASY difficulty, if the keyDetail is a specialist label, you MAY repoint to a more universally recognizable element of the same fact (see EASY-DIFFICULTY REPOINT below).
- CONCISION: include only the MINIMUM disambiguating clues needed to make the answer unambiguous. Do NOT stack multiple clues that would each independently identify the answer — that trivializes the question. The disambiguation rule above tells you to ADD identifying details when multiple answers fit; the concision rule tells you to STOP adding details once the answer is uniquely pinned. Apply both: add enough to disambiguate, no more.
  Concision test: for each non-trivial clue in your question, ask "could a casual player guess the answer from THIS clue alone?" If yes for two or more clues, you are stacking — drop the redundant ones.
- The explanation may elaborate beyond the fact (2-3 sentences).
- Stay in the "${ctx.categoryName}" category. Do not drift.
- Free-text answer; this is NOT a multiple-choice question.

${ctx.difficulty === 'easy' ? `EASY-DIFFICULTY REPOINT (only when difficulty is EASY):
If the keyDetail is a specialist label that a casual player wouldn\'t produce on their own — e.g. the building name "Atomic Bomb Dome" for Hiroshima, the term "modal interchange" for the music idea, the regnal name "Constantine the Great" when "Constantine" is the casual form — REPOINT the question. Ask about a more universally recognizable element of the same fact (the city, the artist, the work, the era), and set correct_answer to that. The specialist label can stay in the explanation. Do not ship an EASY question whose answer is a specialist string.

Examples of the easy repoint:
  fact="The Atomic Bomb Dome in Hiroshima was preserved as a memorial to the 1945 atomic bombing." keyDetail="Atomic Bomb Dome"
    NAIVE: "Which UNESCO World Heritage Site in Hiroshima preserves a skeletal domed building from the 1945 blast?" → "Atomic Bomb Dome" — BAD for easy
    REPOINTED: "Which Japanese city was destroyed by the first wartime atomic bomb in 1945?" → "Hiroshima" — GOOD for easy

  fact="Earth, Wind & Fire received the Lifetime Achievement Grammy in 2012." keyDetail="Lifetime Achievement Grammy Award"
    NAIVE: "What Grammy honor for body of work did Earth, Wind & Fire receive in 2012?" → "Lifetime Achievement Grammy Award" — BAD for easy (fragile string)
    REPOINTED: "Which funk-soul group behind \\"September\\" and \\"Boogie Wonderland\\" received a 2012 Lifetime Achievement Grammy?" → "Earth, Wind & Fire" — GOOD for easy
` : ''}

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

CONCISION BAD: fact="Christopher Nolan's 2008 film The Dark Knight was one of the first to feature IMAX-shot sequences." keyDetail="The Dark Knight"
  Question: "Which 2008 Christopher Nolan superhero film was one of the first to feature sequences shot on IMAX cameras?" → "The Dark Knight"
  → year + director + genre + IMAX innovation each pin the answer alone. The IMAX detail is enough; drop the rest.
  Better: "Which film was among the first major releases to feature sequences shot on IMAX cameras?" → "The Dark Knight"

LEAK BAD: fact="The Pythagorean theorem states that a² + b² = c² for any right triangle." keyDetail="Pythagorean theorem"
  Question: "What is the Pythagorean theorem?"
  → keyDetail appears in the question. To fix, describe the theorem without naming it:
  Better: "What theorem describes the relationship a² + b² = c² between the sides of a right triangle?"

A useful test: if you removed the keyDetail (and obvious synonyms) from your question, would the question still make sense and ask for that specific answer? If not, you have leaked the answer. Reword so the question describes the answer rather than naming it.

If you cannot construct a question that is both unambiguous AND leak-free from this fact, output the best-effort question you can — the reviewer will reject and we will retry with a different fact.`,
    temperature: 0.5,
    maxTokens: 600,
  })
  recordUsage({
    stage: 'construct',
    model: QUESTION_MODEL,
    inputTokens: result.usage?.promptTokens ?? 0,
    outputTokens: result.usage?.completionTokens ?? 0,
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
  const anthropicClient = createAnthropic({ apiKey })

  const result = await generateObject({
    model: anthropicClient(REPAIR_MODEL),
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
- Keep the SAME fact (do not switch facts).
- Address the rejection reason directly — if the reviewer said the answer was leaked, reword so the question describes the answer rather than naming it. If the reviewer said the answer was ambiguous, add identifying details that rule out alternatives.
- The revised question must NOT contain the answer or any obvious synonym of it.
- The revised question must have ONE unambiguous correct answer.
- Stay in the "${draft.categoryName}" category.
- Free-text answer (not multiple choice).
- Default: keep the SAME keyDetail as the answer. EXCEPTIONS where you SHOULD change the correct_answer to a different element of the same fact:
  · The reviewer flagged a "easy-difficulty misfit" or "specialist answer" — repoint to a more universally recognizable element (the city/artist/work/era the fact is about). Put the specialist label INTO the question as a clue.
  · The reviewer flagged a numeric/date answer — repoint to a NAMED entity from the fact, putting the number into the question as a clue.
  In both cases, the new correct_answer must still be supported by the source fact above.

${draft.difficulty === 'easy' ? `For EASY questions specifically: the correct_answer must be a string a casual party-trivia player would naturally produce. Specialist labels ("Atomic Bomb Dome" instead of "Hiroshima"; "Constantine the Great" instead of "Constantine"; "Lifetime Achievement Grammy Award" instead of "Lifetime Achievement Award") are unacceptable for easy. If the source fact's keyDetail is specialist, repoint per the exception above.\n\n` : ''}Output the revised question, the correct_answer, and an explanation. If you genuinely cannot fix this fact's question, output your best attempt — we will fall through to a fresh fact.`,
    temperature: 0.4,
    maxTokens: 600,
  })
  recordUsage({
    stage: 'repair',
    model: REPAIR_MODEL,
    inputTokens: result.usage?.promptTokens ?? 0,
    outputTokens: result.usage?.completionTokens ?? 0,
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

// Tokens that don't count as "real noun content" inside a numeric
// answer — units, qualifiers, era markers, months, articles, etc.
// Used by detectNumericAnswer to decide whether an answer is "just a
// number with maybe some units around it" vs. "a named entity that
// happens to contain a number" (e.g. "Apollo 11", "Area 51").
const NUMERIC_FILLER_WORDS = new Set([
  // approximations
  'about', 'approximately', 'approx', 'roughly', 'around', 'over', 'under', 'nearly', 'almost', 'circa',
  // magnitude qualifiers
  'million', 'millions', 'billion', 'billions', 'thousand', 'thousands', 'hundred', 'hundreds', 'trillion', 'trillions',
  // duration / age
  'year', 'years', 'yr', 'yrs', 'old', 'month', 'months', 'day', 'days', 'hour', 'hours', 'minute', 'minutes', 'second', 'seconds', 'decade', 'decades', 'century', 'centuries',
  // length / distance
  'meter', 'meters', 'metre', 'metres', 'm', 'cm', 'mm', 'km', 'kms', 'kilometer', 'kilometers', 'kilometre', 'kilometres', 'mi', 'mile', 'miles', 'foot', 'feet', 'ft', 'inch', 'inches',
  // weight
  'kg', 'kgs', 'kilogram', 'kilograms', 'g', 'gram', 'grams', 'lb', 'lbs', 'pound', 'pounds', 'ton', 'tons', 'tonne', 'tonnes',
  // descriptors
  'tall', 'wide', 'long', 'deep', 'high', 'across', 'thick', 'heavy', 'large', 'small',
  // era markers
  'ad', 'bc', 'bce', 'ce',
  // months
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
  // weekdays
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  // currency
  'usd', 'eur', 'gbp', 'cent', 'cents', 'dollar', 'dollars',
  // percent
  'percent', 'percentage', 'percents', 'pct',
  // area / volume
  'square', 'cubic',
  // articles / connectives
  'the', 'a', 'an', 'of', 'and', 'or', 'to',
])

// Catch numeric-answer questions ("...how deep / how many / what year /
// what is the depth..." with a year/measurement/count-shaped answer)
// before they reach the player. Trivia where the player has to guess
// a specific number is unfair — the construction prompt is told to
// flip the question (named entity becomes the answer, the number
// becomes a clue) but sometimes ignores the rule. This is the
// deterministic backstop — same pattern as detectAnswerLeak.
//
// The check is answer-side only: if the answer is purely numeric
// content (digits + units + qualifiers + era markers + dates), with
// no real noun anchoring it, fire. Answers like "Apollo 11" or
// "Area 51" survive because they contain a real noun ("Apollo",
// "Area") in addition to the number.
export function detectNumericAnswer(correctAnswer: string): boolean {
  const a = correctAnswer.toLowerCase().trim()
  if (a.length === 0) return false
  // Must contain at least one digit to be considered numeric.
  if (!/\d/.test(a)) return false

  // Strip currency symbols, punctuation, exponent suffixes (², ³, °,
  // %), parens, slashes — they don't carry noun content.
  const cleaned = a.replace(/[$€£¥,.()²³%°/'"]/g, ' ')
  const tokens = cleaned.split(/\s+/).filter((t) => t.length > 0)

  const substantive = tokens.filter((t) => {
    if (/^\d+$/.test(t)) return false  // pure digits
    if (NUMERIC_FILLER_WORDS.has(t)) return false  // unit/qualifier/article
    return true
  })

  return substantive.length === 0
}

async function reviewQuestion(
  apiKey: string,
  draft: DraftQuestion
): Promise<ReviewResult> {
  const anthropicClient = createAnthropic({ apiKey })

  const result = await generateObject({
    model: anthropicClient(REVIEW_MODEL),
    schema: ReviewSchema,
    system:
      'You are a quality reviewer for trivia questions. You evaluate ONLY the question text against the failure modes listed below. Answer-leak checks happen elsewhere (deterministically on the question text alone) — you should NOT flag answer-leaks under any circumstances; that is not your job.',
    prompt: `Review this trivia question for the category "${draft.categoryName}".

Question: ${draft.question}
Expected answer: ${draft.correct_answer}
Difficulty target: ${draft.difficulty.toUpperCase()}

(Source fact and explanation withheld so they cannot be confused with the question text.)

DO NOT FLAG:
- "answer in question" / "answer is leaked" / "answer is stated in question text" — answer-leak detection is performed deterministically on the question text elsewhere in the pipeline. Do not check for or report leaks. Even if you think you see one, do not flag it.

Reject the question ONLY if one of these is true:
- The question has multiple equally-valid answers — it must have ONE specific answer.
- The question is too vague to answer without multiple-choice options.
- The question is nonsensical, broken, or self-contradicting.
- The "expected answer" doesn't actually answer the question.
- The question doesn't belong to category "${draft.categoryName}" — pick the best fit from: ${KNOWN_CATEGORIES.join(', ')}
${draft.difficulty === 'easy' ? `- DIFFICULTY MISFIT (EASY ONLY): The "Expected answer" is a string a casual party-trivia player would NOT naturally produce from this question. Examples that fail this check:
    · Specialist labels for famous things ("Atomic Bomb Dome" instead of "Hiroshima"; "modal interchange" for the music idea; "Genbaku Dome").
    · Regnal/full forms when a casual player would type the short form ("Constantine the Great" → most would type "Constantine"; "Pope John Paul II" is fine because that IS the casual form).
    · Fragile multi-word strings the casual player would partially-match ("Lifetime Achievement Grammy Award" — most would type "Lifetime Achievement Award").
    · Deep-cut historical figures, scientific terms, building/work names that require category expertise.
  Test: would 70%+ of casual players (no special interest in this category) produce the EXACT "Expected answer" string from this question? If no, reject with reason "easy-difficulty misfit: <one phrase on what makes the answer too specialist>".` : ''}

Set accept=true if all checks pass. If you reject, give a one-sentence rejection_reason naming the specific failure. inferred_category is the category you think the question best belongs to.`,
    temperature: 0,
    maxTokens: 200,
  })
  recordUsage({
    stage: 'review',
    model: REVIEW_MODEL,
    inputTokens: result.usage?.promptTokens ?? 0,
    outputTokens: result.usage?.completionTokens ?? 0,
  })

  // Defense in depth: the prompt tells the LLM not to flag leaks, but
  // smaller models sometimes hallucinate one anyway by reading the
  // "Expected answer:" prompt line as if it were the question. If we
  // see a rejection that names a leak-style reason, override the
  // accept decision — the deterministic detectAnswerLeak() pre-check
  // is the source of truth for leaks, and if it didn't fire, there is
  // no leak.
  const reason = result.object.rejection_reason ?? ''
  const looksLikeLeakHallucination =
    !result.object.accept &&
    /\b(leak|appears? in (the )?question|stated in (the )?question|in the question text|in the question)\b/i.test(reason)

  return {
    accept: result.object.accept || looksLikeLeakHallucination,
    reason: looksLikeLeakHallucination ? null : (result.object.rejection_reason ?? null),
    inferred_category: result.object.inferred_category,
  }
}

// For EASY generations, rank the candidate facts by how recognizable
// their keyDetail would be to a casual trivia player and pick the
// most-recognizable one. The seed picker (B) does most of this work
// upstream by narrowing the seed pool, but a single seed (e.g. "World
// War 2") can still produce facts that vary widely in fame ("Pearl
// Harbor" vs "Operation Market Garden"). Cheap Haiku call; falls back
// to pickRandom on failure so a transient model error never blocks the
// pipeline.
async function pickEasiestFact(
  apiKey: string,
  facts: Fact[],
  categoryName: string
): Promise<Fact> {
  if (facts.length <= 1) return facts[0]

  const PickSchema = z.object({
    pickedIndex: z
      .number()
      .int()
      .min(0)
      .max(facts.length - 1)
      .describe('Index of the most universally recognizable fact for an easy question.'),
  })

  try {
    const anthropicClient = createAnthropic({ apiKey })
    const result = await generateObject({
      model: anthropicClient(REVIEW_MODEL),
      schema: PickSchema,
      system:
        'You rank trivia facts by how recognizable their answer (keyDetail) would be to a typical adult who has never specifically studied this category. Lower is more recognizable.',
      prompt: `Category: ${categoryName}
Pick the fact whose keyDetail is the name a typical casual trivia player would most readily produce — household-name people, places, works, events; common short answer strings; things taught in school or dominant in pop culture.

Avoid: specialist labels for famous things ("Atomic Bomb Dome" vs "Hiroshima"), regnal forms when shorter casual forms exist ("Constantine the Great" vs "Constantine"), scientific/technical terms, deep-cut historical figures, obscure works.

Facts:
${facts.map((f, i) => `[${i}] keyDetail: "${f.keyDetail}" — ${f.claim}`).join('\n')}

Output the index (0-based) of the best fact for an easy question.`,
      temperature: 0,
      maxTokens: 50,
    })
    recordUsage({
      stage: 'factPicker',
      model: REVIEW_MODEL,
      inputTokens: result.usage?.promptTokens ?? 0,
      outputTokens: result.usage?.completionTokens ?? 0,
    })
    const idx = Math.max(0, Math.min(facts.length - 1, result.object.pickedIndex))
    return facts[idx]
  } catch (err) {
    console.warn('[pickEasiestFact] failed, falling back to random', {
      error: err instanceof Error ? err.message : String(err),
    })
    return pickRandom(facts)
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
 *   2. Question construction (Claude Sonnet 4.6) — pick a fact and
 *      turn it into a question whose answer is the fact's keyDetail.
 *   3. Inner repair loop:
 *      a. Deterministic pre-check (detectAnswerLeak) for verbatim
 *         keyDetail leaks — fast-fails before a reviewer call.
 *      b. Quality review (Claude Haiku 4.5, temp 0) — strict reviewer.
 *      c. If rejected, call repairDraft (Sonnet 4.6) with the
 *         rejection reason as targeted feedback. Up to
 *         MAX_REPAIRS_PER_DRAFT repairs per draft before falling
 *         through to a fresh fact.
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
 *
 * The returned question carries provenance — `appVersion` (commit hash)
 * and `models` (per-stage model id) — so we can later attribute quality
 * regressions to a model swap or prompt change.
 */
export async function generateInfiniteQuestion(
  options: GenerateInfiniteQuestionOptions = {}
): Promise<GeneratedQuestion> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Anthropic API key not configured')

  const factSource = options.factSource ?? getDefaultFactSource()

  let lastReason = 'unknown'
  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
    const difficulty = options.difficulty ?? pickDifficulty()
    const modifiers = MODIFIERS_BY_DIFFICULTY[difficulty]
    const modifier = pickRandom(modifiers)

    let categoryName: string
    let seedSummary: string
    let resolvedCategoryId: number | null

    if (options.customCategory) {
      // Custom topic: use the topic name directly, skip preset category lookup
      categoryName = options.customCategory
      seedSummary = `${options.customCategory} :: ${modifier}`
      resolvedCategoryId = null
    } else {
      const categoryId = options.categoryId ?? pickCategoryId()
      resolvedCategoryId = categoryId
      categoryName = getOpenTDBCategoryName(categoryId)
      // Difficulty-aware seed + modifier selection. Easy generations
      // pick from iconic / common-knowledge seeds and "origin / first /
      // most famous" modifiers; hard generations pick from niche seeds
      // and "cut content / exploit / headcanon" modifiers. Both pools
      // fall back to broader buckets when their preferred bucket is
      // empty for a category — see seedsByDifficulty.ts /
      // modifiersByDifficulty.ts.
      const seeds = getSeedsForDifficulty(categoryId, difficulty)
      const seedWord = pickRandom(seeds.length > 0 ? seeds : (CATEGORIZED_SEEDS[categoryId] ?? CATEGORIZED_SEEDS[9]))
      seedSummary = `${seedWord} :: ${modifier}`
    }

    let facts: Fact[]
    try {
      facts = await factSource.fetchFacts({
        categoryId: resolvedCategoryId,
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

    // For easy, ask Haiku to pick the fact with the most casually-
    // recognizable keyDetail. For medium/hard, randomness keeps things
    // varied. Falls back to random if the picker call fails.
    const fact = difficulty === 'easy' && facts.length > 1
      ? await pickEasiestFact(apiKey, facts, categoryName)
      : pickRandom(facts)
    let draft = await constructQuestionFromFact(apiKey, fact, {
      categoryName,
      difficulty,
      seedSummary,
    })

    // Track which models actually ran for this question. Repair is
    // populated only if the inner loop invokes it; review is set the
    // first time the reviewer is called.
    const models: QuestionGenerationModels = {
      question: QUESTION_MODEL,
    }
    if (factSource.model) models.facts = factSource.model
    if (difficulty === 'easy' && facts.length > 1) models.factPicker = REVIEW_MODEL

    // Inner repair loop: try to fix this draft up to MAX_REPAIRS_PER_DRAFT
    // times before falling through to a fresh outer attempt.
    let acceptedDraft: DraftQuestion | null = null
    let acceptedReview: ReviewResult | null = null

    for (let repair = 0; repair <= MAX_REPAIRS_PER_DRAFT; repair++) {
      // Deterministic pre-check: if the question echoes the answer
      // verbatim, attempt repair without paying for a reviewer call.
      // We check against draft.correct_answer (not fact.keyDetail) so
      // intentional repoints — numeric flips, easy-difficulty repoints —
      // can put the original keyDetail into the question as a CLUE
      // without spurious leak rejection.
      if (detectAnswerLeak(draft.question, draft.correct_answer)) {
        const reason = `Question contains the answer "${draft.correct_answer}" verbatim. Reword so the question describes the answer rather than naming it.`
        lastReason = `pre-check leak: ${reason}`
        console.warn('[generateInfiniteQuestion] draft rejected (pre-check)', {
          attempt,
          repair,
          category: categoryName,
          correctAnswer: draft.correct_answer,
          question: draft.question,
        })
        if (repair < MAX_REPAIRS_PER_DRAFT) {
          try {
            draft = await repairDraft(apiKey, draft, reason)
            models.repair = REPAIR_MODEL
          } catch (err) {
            lastReason = `repair failed: ${err instanceof Error ? err.message : String(err)}`
            console.warn('[generateInfiniteQuestion] repair threw', { attempt, repair, reason: lastReason })
            break
          }
          continue
        }
        break
      }

      // Deterministic pre-check: catch numeric-answer questions before
      // they reach the player. Trivia where the answer is just a
      // number, year, date, or measurement is unfair (the player has
      // to guess). The construction prompt is supposed to flip these
      // but the LLM sometimes ignores the rule.
      if (detectNumericAnswer(draft.correct_answer)) {
        const reason = `The current answer "${draft.correct_answer}" is a number, year, date, or measurement. Numeric answers are unfair — players have to guess. FLIP the question: ask about a NAMED entity in the source fact (the person, place, work, event, or thing the number describes) and put the number INSIDE the question text as a discriminating clue. Adjust correct_answer to that named entity. Example: instead of "What is the depth of Lake Baikal?" → "1,642 meters", ask "Which Russian lake reaches a maximum depth of 1,642 meters?" → "Lake Baikal".`
        lastReason = `pre-check numeric-answer: ${reason}`
        console.warn('[generateInfiniteQuestion] draft rejected (pre-check numeric-answer)', {
          attempt,
          repair,
          category: categoryName,
          correctAnswer: draft.correct_answer,
          question: draft.question,
        })
        if (repair < MAX_REPAIRS_PER_DRAFT) {
          try {
            draft = await repairDraft(apiKey, draft, reason)
            models.repair = REPAIR_MODEL
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
      models.review = REVIEW_MODEL
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
          models.repair = REPAIR_MODEL
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
      // Duplicate-answer backstop: even with the seed-bound Perplexity
      // prompt, different seeds can still surface the same famous
      // answer (e.g. multiple seeds in Art genuinely landing on
      // "Mona Lisa"). If an active question with this exact answer
      // already exists, fall through to the next outer attempt — that
      // re-rolls the seed, which usually produces a different answer.
      const dupeId = await findActiveDuplicateAnswer(acceptedDraft.correct_answer)
      if (dupeId) {
        lastReason = `duplicate answer: "${acceptedDraft.correct_answer}" already exists as active question ${dupeId}`
        console.warn('[generateInfiniteQuestion] duplicate-answer rejection', {
          attempt,
          category: categoryName,
          seed: seedSummary,
          factSource: factSource.id,
          factSourceCitation: fact.source,
          correctAnswer: acceptedDraft.correct_answer,
          duplicateId: dupeId,
        })
        continue
      }

      const id = `ai-infinite-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      console.info('[generateInfiniteQuestion] generated', {
        id,
        category: categoryName,
        difficulty,
        attempt,
        factSource: factSource.id,
        factSourceCitation: fact.source,
        inferredCategory: acceptedReview.inferred_category,
        appVersion: APP_VERSION,
        models,
      })
      return {
        id,
        question: acceptedDraft.question,
        correctAnswer: acceptedDraft.correct_answer,
        explanation: acceptedDraft.explanation,
        category: categoryName,
        difficulty,
        type: 'free-text',
        appVersion: APP_VERSION,
        models,
        seed: seedSummary,
        ...(fact.source ? { sourceUrl: fact.source } : {}),
      }
    }
  }

  throw new Error(
    `Generation failed quality gate after ${MAX_GENERATION_ATTEMPTS} attempts: ${lastReason}`
  )
}
