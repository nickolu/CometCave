# Round 003 — decision

**Round closed:** 2026-05-12
**Verdict:** revert B-002 (Haiku easy-specialist guard)
**Action:** remove `detectEasySpecialistAnswer` and its inner-loop invocation from `generateQuestion.ts`. Restore the round-001 winner as the live baseline.

## Scorecard

Three samples now on HEAD (B-002 code, includes the Haiku
easy-specialist guard). Compared against round-002 arm A (round-001
winner code, no guard) as a one-sample reference.

| Slice | R002 A (no guard) | R002 B | R003 run1 | R003 run2 | HEAD mean (B+r1+r2) | Δ vs A |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Overall | 67.1% | 66.5% | 65.3% | 64.0% | 65.3% | -1.8 pp |
| Easy | 52.9% | 64.3% | 50.6% | 57.1% | 57.3% | +4.4 pp |
| Medium | 76.5% | 74.1% | 75.3% | 72.9% | 74.1% | -2.4 pp |
| Hard | 71.8% | 61.2% | 69.9% | 61.9% | 64.3% | -7.5 pp |

| Metric | R002 A | HEAD mean |
| --- | ---: | ---: |
| factual μ | 2.75 | 2.76 |
| difficulty μ | 2.79 | 2.81 |
| concision μ | 2.61 | 2.54 |
| Easy difficulty μ | 2.42 | 2.52 |

## Reading

**The guard mechanism works.** It fired 18 times in run1 (~21% of
easy trials), lifting easy difficulty μ from 2.42 → 2.52 consistently
across all three HEAD samples. Easy ship rate also moved positively
(+4.4 pp mean), though much smaller than R002 B alone suggested.

**But hard is a real -7.5 pp regression**, not noise. Two of three
HEAD samples landed at 61–62% hard vs the no-guard 71.8%. The third
sample (R003 run1) landed at 69.9%, but the population mean of three
samples is clearly below A.

**Mechanism unknown but plausibly real.** The guard code never enters
the difficulty !== 'easy' branch, yet hard cells consistently show
lower ship rate when the guard is enabled in the pipeline. Best
guesses, in descending plausibility:

1. **Rate-limit pressure displacement.** The extra Haiku call per easy
   trial increases Anthropic-API contention across the run. At
   concurrency 2, this could shift effective parallelism / retry
   timing for the Sonnet construct + repair stages on hard cells.
   R003 run1 saw 10 gen-fails vs A's 0 — consistent with timing
   pressure.
2. **`MAX_REPAIRS_PER_DRAFT` budget pressure.** If the guard's
   repair triggers consume some shared client-side capacity (event
   loop, connection pool), hard cells may complete their loops with
   less budget. But the budget is per-trial, not shared, so this
   should not matter — keeping it as a long-tail possibility.
3. **Random sample bad luck**, repeated. Less likely with 3 samples,
   but at 75 hard cells per sample the std on shipPct is ~5 pp, so
   2/3 samples at -10 pp is rare-but-possible.

**Net cost-benefit doesn't justify shipping the guard as-is.** Even
generously crediting the easy lift, the overall ship rate goes the
wrong direction.

## Promotion action

1. Revert `detectEasySpecialistAnswer` and its inner-loop wiring in
   `src/lib/trivia/generateQuestion.ts`.
2. Update `evals/runs/latest.json` to a fresh round-001-winner-code run
   so future eval comparisons start from the known good baseline.
3. Keep `QuestionGenerationModels.easySpecialistCheck` and the
   `'easySpecialistCheck'` GenerationStage in place — no harm in
   leaving the type machinery, and a future round can reuse them.

## Round 004 candidates

The easy-tier problem is still on the table; B-002's approach was right
in spirit but wrong in cost. Next attempts:

1. **Cheap deterministic easy guard.** Instead of a Haiku call,
   maintain a curated list of specialist-label heuristics (regnal
   forms, multi-word "Award" strings, ".com Productions" patterns,
   acronyms shorter than the spelled-out term, etc.) and reject easy
   drafts whose `correct_answer` matches. Zero extra LLM cost → can't
   regress hard.
2. **Easy-tier-only difficulty repair in construction prompt.** Today
   the easy repoint is a soft suggestion at construction time. Promote
   it to a hard rule in the construction system prompt (not the user
   message), where Sonnet 4.6 tends to follow more strictly.
3. **Investigate the hard regression mechanism directly.** Run B-002
   code at concurrency 1 for a hard-only smoke (75 cells × 5 trials).
   If hard ship still lands at 60%, the mechanism is something other
   than rate-limit contention.
