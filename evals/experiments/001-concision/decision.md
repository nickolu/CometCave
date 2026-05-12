# Round 001 — decision

**Round closed:** 2026-05-07 09:30 PDT
**Winner:** Arm B (construction-concision)
**Promoted into baseline:** yes

## Scorecard

All arms run as 51 cells × 5 trials = 255 jobs, judged by `gpt-4o`.

| Arm | Ship % | Δ vs A | factual μ | difficulty μ | concision μ | gen-fail | cost (USD) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A baseline | 57.5% | — | 2.77 | 2.76 | 2.41 | 1 | $5.16 |
| **B construction-concision** | **67.1%** | **+9.6** | 2.75 | 2.79 | **2.61** | 0 | ~$5 |
| C review-concision | 64.2% | +6.7 | 2.77 | 2.77 | 2.52 | 0 | ~$5 |
| D perplexity-grounding | 63.0% | +5.5 | 2.78 | 2.81 | 2.51 | 0 | ~$5 |

## Reading

**B wins.** The construction-side concision rule moved ship-worthy by
+9.6 pp and lifted concision μ by +0.20 (its target dimension) without
regressing any other dim by more than noise (factual −0.02, difficulty
+0.03). Both other-dim deltas are inside the ±0.02 noise floor seen
across A↔C and A↔D.

**C is the runner-up.** The review-side concision rule still moves the
needle (+6.7 pp) but lands behind B by 2.9 pp. Intuition: review-time
catches require a repair pass, and the repair budget is bounded
(`MAX_REPAIRS_PER_DRAFT = 2`); rewriting at construction time is a more
direct fix because the question is shaped correctly the first time.
The two changes are not orthogonal — stacking both would likely produce
sub-additive gains since they fight the same failure mode through
different stages.

**D is third but is the best on its target dimension.** The Perplexity
grounding rule lifted factual μ by +0.01 — small, but the target dim
was already the strongest in baseline (μ 2.77, leaving little headroom).
Difficulty μ also went up by +0.04. The cost: D took 4,216 s vs B's
1,827 s (≈ 2.3× slower) because the stricter grounding rule produced
more "no facts" outcomes and triggered more outer retries. Worth
revisiting in a later round once we hit factual ceilings on B's pipeline.

**Easy-tier remains the weakest segment.** Baseline easy ship 43.5% vs
medium/hard 64–65%. None of the round-001 arms specifically targeted
easy-tier difficulty calibration; the easy/specialist-label problem is
still on the table for round 002.

## Promotion action

1. Re-applied B's diff to `src/lib/trivia/generateQuestion.ts`
2. Copied B's run.json to `evals/runs/latest.json` so the next eval
   compares against B as the new baseline
3. `evals/experiments/log.md` updated

## Round 002 candidates

Carrying forward the failure modes the data still flags:

- **Easy-tier specialist guard** (was Round-001 D-alt) — promote the
  easy-difficulty repoint from soft prompt guidance to a deterministic
  post-construction check, similar to `detectAnswerLeak`. Targets the
  43.5% easy-tier ship rate.
- **Music / Television fact source** — both stuck at 33.3% ship in the
  baseline run. Worth investigating whether their seed pools or
  Perplexity coverage is the bottleneck.
- **`--save` flag on `eval:trivia`** — non-experiment hygiene work. Lets
  ship-eligible eval generations pipe to `saveAIQuestion` so the cost
  of measurement also grows the question pool. Default off so
  experiments stay clean.
