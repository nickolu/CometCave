# AI Question Storage + Rating

## Context

We currently generate AI trivia questions in two places — runtime fallback in `/api/v1/trivia/daily/route.ts` and the backfill script `scripts/backfill-ai-trivia.ts` — and persist them only as JSON files on disk. JSON works for daily-trivia delivery but blocks two things we want next:

1. **An "infinite trivia" mode** that samples from the entire library of generated questions across days and categories.
2. **Question quality feedback** — thumbs up/down + reason — so we can iterate on prompts and prune bad questions.

Plan: mirror every newly-generated AI question into Firestore alongside the JSON-file write (additive, non-breaking), and add a rating subcollection. The local JSON files stay as the fast-path for daily trivia for now; eventually a cron job replaces them entirely (out of scope for this PR).

## Goals

- Every AI generation persists to Firestore (`aiQuestions/{id}`), in addition to the existing JSON file write.
- Schema supports multiple question types now (`multiple-choice`, `free-text`) and accommodates future types via a discriminated `type` field.
- Logged-in users can rate AI questions (thumbs up/down + optional reason) from the results screen.
- Rating writes are atomic (transactional update of denormalized counters on the parent).
- All Firestore writes go through admin-SDK server routes; client never touches `aiQuestions/*` directly.

## Non-goals

- Backfilling existing AI questions from JSON files into Firestore (separate one-shot migration later).
- Replacing JSON files as the daily-trivia source (deferred to the cron-job work).
- Rating OpenTDB questions — out of scope by user request.
- Building the "infinite trivia" mode itself; this PR just lays the storage foundation.

## Schema

### `aiQuestions/{id}`

Doc id is the existing question id (e.g., `ai-2026-04-28-0`, `ai-fallback-2026-04-28-1`).

```
{
  id: string,
  type: 'multiple-choice' | 'free-text',  // discriminator
  question: string,
  correctAnswer: string,
  explanation?: string,
  difficulty: 'easy' | 'medium' | 'hard',
  category: string,                        // human label, e.g. "Science"
  categoryId?: number,                     // OpenTDB-style id when applicable

  // Type-specific
  options?: string[],                      // multiple-choice only

  // Provenance
  source: 'ai',
  model: string,                           // e.g. "gpt-4o-mini"
  generatedAt: Timestamp,
  generatedFor?: { date: string },         // YYYY-MM-DD if generated for a specific daily

  // Denormalized rating aggregates (server-maintained)
  ratings: { up: number, down: number },
  lastRatedAt: Timestamp | null
}
```

### `aiQuestions/{id}/ratings/{uid}`

One doc per user per question. Overwrites on re-rating (so a user can flip up→down).

```
{
  uid: string,
  vote: 'up' | 'down',
  reason: string | null,                   // up to ~500 chars, trimmed
  ratedAt: Timestamp
}
```

### TypeScript discriminated union

```ts
type BaseAIQuestion = {
  id: string
  question: string
  correctAnswer: string
  explanation?: string
  difficulty: 'easy' | 'medium' | 'hard'
  category: string
  categoryId?: number
  source: 'ai'
  model: string
  generatedAt: Timestamp
  generatedFor?: { date: string }
  ratings: { up: number; down: number }
  lastRatedAt: Timestamp | null
}

type MultipleChoiceAIQuestion = BaseAIQuestion & {
  type: 'multiple-choice'
  options: string[]
}

type FreeTextAIQuestion = BaseAIQuestion & {
  type: 'free-text'
}

export type AIQuestion = MultipleChoiceAIQuestion | FreeTextAIQuestion
```

## Server libs

### `src/lib/trivia/aiQuestions.ts` (new)

```ts
saveAIQuestion(input: NewAIQuestionInput): Promise<{ created: boolean }>
```
- Idempotent: in a transaction, read the doc; if it exists, do nothing. Otherwise write with `ratings: { up: 0, down: 0 }`, `lastRatedAt: null`, `generatedAt: serverTimestamp()`.

```ts
rateAIQuestion(uid, questionId, vote, reason): Promise<{ ratings: { up, down } }>
```
- Transaction:
  1. Read `aiQuestions/{id}` — return 404 if missing.
  2. Read `aiQuestions/{id}/ratings/{uid}` — capture previous vote (if any).
  3. Compute counter deltas: previous=undefined + new=up → up:+1; previous=up + new=down → up:-1, down:+1; etc.
  4. Write rating doc + update parent `ratings` + `lastRatedAt`.

## API surface

### `POST /api/v1/trivia/questions/{id}/rate`
- Auth required.
- Body: `{ vote: 'up' | 'down', reason?: string }`. Validate `vote` enum, sanitize `reason` (trim, max 500 chars).
- Calls `rateAIQuestion(uid, id, vote, reason)`. Returns `{ vote, ratings }`.
- 404 if question doesn't exist; 400 on bad input.

(No GET endpoint for v1 — counters are denormalized on the question doc and the rating UI doesn't need to display its own previous vote initially. Add later if needed.)

## Generator hooks

### `src/app/api/v1/trivia/daily/route.ts`
Right after each `generateAIQuestion` / `generateFallbackQuestions` call, fire-and-forget call to `saveAIQuestion` for every produced AI question. Don't await — generator latency is already user-facing.

### `scripts/backfill-ai-trivia.ts`
Awaits `saveAIQuestion` for each AI question after writing the JSON file. (Script is offline; can afford to await.)

## Game / Results integration

The rating UI lives on the results screen, next to each AI question in the per-question breakdown. To know which questions were AI, the results screen needs question metadata.

### `src/app/trivia/models/trivia.ts` — extend `TriviaAnswer`
```ts
export interface TriviaAnswer {
  questionIndex: number
  questionId: string             // NEW — id of the question
  source: 'opentdb' | 'ai'       // NEW — drives rating UI visibility
  correct: boolean
  points: number
  timeMs: number
}
```
Both new fields are populated in `TriviaGame.submitAnswer` and `handleTimeUp`. They flow through to:
- `TriviaResults` (used to render rating widgets)
- `users/{uid}/triviaGames/{date}.answers` (persisted in the game record — additive, no migration needed)

### New: `src/app/trivia/components/QuestionRating.tsx`
- Thumbs-up / thumbs-down pair, plus a small inline reason field that appears on click.
- Optimistic UI: vote highlighted immediately, reverts on API error.
- Per-session memory of "rated" so user doesn't double-vote in one results view.

### `src/app/trivia/components/TriviaResults.tsx`
- For each row in the per-question breakdown, if `answer.source === 'ai'`, render `<QuestionRating questionId={answer.questionId} />`.
- Layout adjustment for the row to fit thumbs without crowding the existing time/points display.

## Firestore security rules (`firestore.rules`)

Add:
```
match /aiQuestions/{id} {
  allow read: if false;                   // server-only access
  allow write: if false;
  match /ratings/{uid} {
    allow read, write: if false;
  }
}
```
All rating + question reads/writes go via API routes using the admin SDK. Keeps surface minimal.

## Files

### New
- `src/lib/trivia/aiQuestions.ts` — `saveAIQuestion`, `rateAIQuestion`
- `src/app/api/v1/trivia/questions/[id]/rate/route.ts`
- `src/app/trivia/components/QuestionRating.tsx`

### Modified
- `src/app/trivia/models/question.ts` — add discriminated `AIQuestion` types (alongside existing `TriviaQuestion` for back-compat)
- `src/app/trivia/models/trivia.ts` — extend `TriviaAnswer` with `questionId` + `source`
- `src/app/trivia/components/TriviaGame.tsx` — populate new fields in `submitAnswer` + `handleTimeUp`
- `src/app/trivia/components/TriviaResults.tsx` — embed `<QuestionRating>` next to AI rows
- `src/app/api/v1/trivia/daily/route.ts` — fire-and-forget `saveAIQuestion` for each generated AI question
- `scripts/backfill-ai-trivia.ts` — await `saveAIQuestion` per generated question
- `firestore.rules` — deny client access to `aiQuestions/**`

### Existing utilities reused
- `src/lib/api/auth.ts` — `verifyRequestAuth`
- `src/lib/firebase/server.ts` — admin SDK (`getFirestoreDb`)
- `src/app/trivia/lib/questionCache.ts` — unchanged; daily JSON path remains fast-path

## Verification

1. **Generation persists.** Trigger AI generation (visit /trivia on a day OpenTDB underdelivers, or run `npm run backfill-ai-trivia` for a future date). Confirm `aiQuestions/{id}` doc exists with the right shape, including `ratings: { up: 0, down: 0 }`.
2. **Idempotent on re-generation.** Re-run for the same date — counters not clobbered, `generatedAt` not updated.
3. **Rating round-trip.** Sign in, complete a game with AI questions, click thumbs-up on one → verify `aiQuestions/{id}.ratings.up = 1` and `aiQuestions/{id}/ratings/{uid}` doc exists. Click thumbs-down on the same question → verify up:0, down:1 (no double-counting).
4. **Anonymous can't rate.** Anon gets 401 from POST /rate.
5. **Type discriminator works.** Generated multiple-choice question has `type: 'multiple-choice'` + `options` populated; free-text has `type: 'free-text'`, no `options`.
6. **Game answers carry id + source.** New `triviaGames/{date}.answers[i]` docs include `questionId` and `source`.
7. **Lint, typecheck, Vercel preview** all pass.
8. **Rules updated** — confirm `firestore.rules` deployed and client direct read of `aiQuestions/*` returns permission-denied.

## Open questions to confirm before implementation

1. **Reason field UX.** Required when voting down? Optional always? (Default proposal: optional always, max 500 chars.)
2. **Anonymous rating.** Allow without auth (uid = null, dedupe by IP — messy)? Or auth-only? (Default proposal: auth-only.)
3. **Display of community ratings on the question.** Do we surface `ratings.up / ratings.down` to users in the rating widget, or keep it admin-only for now? (Default proposal: keep hidden for v1; surface later if useful.)
