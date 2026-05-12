# Round 001 — concision

**Date:** 2026-05-07
**Baseline commit:** `235241b` (branch `trivia/vote-gate`, with uncommitted 3-dim judge changes)
**Eval config:** full sweep (51 cells) × 5 trials = 255 jobs/arm, judge = `gpt-4o`

## Motivation

The 240-question seed run on 2026-05-07 (logs at `/tmp/cometcave-seed/`)
produced this aggregate:

| Dim | 3 | 2 | 1 |
| --- | --- | --- | --- |
| factual | 87% | 3% | 10% |
| difficulty | 72% | 13% | 15% |
| **concision** | **68%** | **3%** | **29%** |

Concision is the dominant gate driver. The judge's rationales repeatedly
flag clue-stacking ("the year, director, and IMAX innovation all
independently point to The Dark Knight"). The construction prompt has
no anti-stacking rule today; the reviewer doesn't check for it either.

## Arms

### A — baseline

No code changes. Establishes the round's noise floor.

### B — construction-concision

Add a "no redundant identifying clues" rule to the construction prompt
in `src/lib/trivia/generateQuestion.ts`. Targets the issue at the source
where the question text is first written.

### C — review-concision

Add a concision check to the reviewer rubric in `reviewQuestion`. The
reviewer currently catches ambiguity / vagueness / category-drift /
easy-difficulty misfit. Adding concision lets the inner repair loop fix
clue-stacking before the question is written, which is cheaper than
re-rolling on a fresh fact.

### D — perplexity-grounding

Tighten the Perplexity fact-source prompt in
`src/lib/trivia/factSources/perplexityFactSource.ts` to require each
fact be a direct quote or close paraphrase from a single search-result
snippet (no cross-source synthesis). Targets the 10% factual-1 rate.
Indirectly may also reduce concision failures by producing tighter
single-claim facts.

## Predicted effect (pre-run)

- B: ship-rate ↑ 5–8 pp via concision-1 ↓ ~10 pp. Risk: difficulty may
  drift if the model strips too much context.
- C: ship-rate ↑ 3–6 pp via repair loop converting concision-1 →
  concision-3. Slower per-question (more reviewer/repair calls) but no
  difficulty risk.
- D: ship-rate ↑ 2–4 pp via factual-1 ↓ ~3 pp. Smaller surface;
  unlikely to be the round winner unless B and C both regress.

## Promotion rule

Winner must beat A's ship % by ≥3 pp without regressing any single
dimension by >2 pp. If multiple arms qualify, prefer the smaller patch.
