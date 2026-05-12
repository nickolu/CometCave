# Trivia eval + seeding

Two scripts share the same generation pipeline and judge:

- `npm run eval:trivia:smoke` / `npm run eval:trivia` — measure quality (read-only by default)
- `npm run seed-ai-questions` — bulk-write to Firestore (with optional judge filter)

## Eval

Replays `generateInfiniteQuestion` against a curated set of `(category, difficulty)` cells, scores each result with an OpenAI judge on **factual accuracy**, **difficulty calibration**, and **concision**, and prints a scorecard with deltas vs. the previous run.

```
npm run eval:trivia:smoke              # 15 cells × 1 trial, ~60s
npm run eval:trivia                    # 51 cells × 3 trials, ~5min
npm run eval:trivia:smoke -- --trials 3 --concurrency 4
npm run eval:trivia -- --save          # ship-eligible generations also written to Firestore
```

`--save` persists ship-eligible generations to the live `aiQuestions`
collection (createdBy=`system-eval`) so the cost of measurement also
grows the question pool. Off by default — turn it on for production
runs, leave it off when you are A/B testing prompt changes (otherwise
arm-N's saves seed arm-N+1's duplicate-answer backstop, contaminating
the comparison).

Inner loop: baseline → change a prompt or model → run smoke → read deltas.

Reading the scorecard:
- `ship-worthy` line under "Quality (overall)" is the headline metric — % of generations the judge would let through.
- `↑/↓` arrows show per-dimension deltas vs. `evals/runs/latest.json`.
- "Worst-scoring questions" lists low-score examples with rationales.

Persistence: each run writes a timestamped JSON to `evals/runs/`; `latest.json` is the rolling baseline (committed). Other run files are gitignored.

Override the judge model with `OPENAI_EVAL_MODEL=gpt-4.1` (default `gpt-4o`).

## Seeding

Bulk-writes new questions to the live `aiQuestions` Firestore collection. Same pipeline as the runtime warmer (`src/lib/trivia/warmQuestionPool.ts`), including the duplicate-answer backstop.

```
npm run seed-ai-questions -- --count 20
npm run seed-ai-questions -- --count 50 --difficulty easy
npm run seed-ai-questions -- --count 100 --gate     # only save ship=true
npm run seed-ai-questions -- --count 50 --no-judge  # skip judging entirely
npm run seed-ai-questions -- --count 30 --category 17
```

Default behavior judges every question and saves all of them. Pass `--gate` to drop questions the judge wouldn't ship. Pass `--no-judge` to skip judging entirely (faster, no quality signal).

End-of-run scorecard summarizes saved/gated/failed counts and the judge-score distribution. Worst-scoring examples are printed even without `--gate` so you know what kind of output the pipeline is letting through.

## Required env

Loaded from `.env.local` via `tsx --env-file`:

- `ANTHROPIC_API_KEY` — generation pipeline
- `PERPLEXITY_API_KEY` — fact source (if Perplexity is the configured `FactSource`)
- `OPENAI_API_KEY` — judge (omit if `--no-judge` on the seeder)
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` — seeder, or `eval:trivia --save`
