# Round 002 — easy-tier specialist-label gap

**Date:** 2026-05-12
**Baseline:** round-001 winner (arm B, construction-concision), already promoted into source
**Eval config:** full sweep (51 cells) × 5 trials = 255 jobs/arm, judge = `gpt-4o`
**Baseline run.json source:** copied from `001-concision/arms/B-construction-concision/run.json` — no fresh re-run for round 002 since that file is the same code at the same concurrency (2). Will accept up to ~2 pp of noise on the baseline reading; promotion bar is still +3 pp.

## Motivation — arm-B baseline numbers

| Slice | Ship % | factual μ | difficulty μ | concision μ |
| --- | ---: | ---: | ---: | ---: |
| Overall | 67.1% | 2.75 | 2.79 | 2.61 |
| Easy | **52.9%** | 2.85 | **2.42** | 2.46 |
| Medium | 76.5% | 2.73 | 2.94 | 2.72 |
| Hard | 71.8% | 2.66 | 3.00 | 2.65 |

Easy-tier ship rate sits **23.6 pp behind medium** with the lowest
difficulty μ on the board. The easy-difficulty repoint rule that exists
in the construction prompt is a soft suggestion the model ignores
often. Specialist-label answers ("HOUSE" for frequent flyer, "Desilu
Productions" for Lucille Ball's company, "modal interchange") keep
shipping as easy-tier.

## Arms

### A — baseline

Round-001 winner code, reused run.json. No code change.

### B — Haiku easy-specialist guard

Add a Haiku-backed check in the inner repair loop in
`generateQuestion.ts`. When `difficulty === 'easy'`, call Haiku with a
one-shot "would 70%+ of casual players naturally produce this exact
answer string?" Yes → continue; No → force a repair pass with an
easy-specialist rejection reason. Same shape as
`detectAnswerLeak` / `detectNumericAnswer` but LLM-backed because the
heuristic isn't deterministic. Cost impact: +1 Haiku call per easy
trial ≈ +$0.013 over a 255-job run.

### C — harden easy DIFFICULTY_GUIDANCE in Perplexity prompt

Plain text edit in `perplexityFactSource.ts`. Replaces the current
"common knowledge" guidance with explicit rejection examples and a
"SKIP THE FACT if the keyDetail is …" list. Kills the problem at fact
source rather than catching specialist answers downstream.

### D — strict grounding for Video Games + Computers

Per-category factual-rigor uplift, inspired by round-001 arm D but
scoped. The two categories with worst factual scores (Video Games
f=2.20, Computers f=2.40) get the "single-snippet, no synthesis"
grounding rule appended to the Perplexity prompt. Other categories
unchanged. Targets factual μ on those cats, not overall ship rate.

## Predicted effect (pre-run)

- B: easy ship +5–10 pp, overall +2–4 pp. Risk: occasional spurious
  rejections of fine answers if the Haiku check is too strict.
- C: easy ship +3–6 pp, overall +1–3 pp. Lower ceiling than B because
  fact-source filtering only catches the problem upstream of
  construction — once a specialist fact survives, the construction
  prompt still has to do the right thing.
- D: overall +1–2 pp; the lift is concentrated in two categories.
  Factual μ on Video Games / Computers up ~0.3.

## Promotion rule

Same as round 001: winner must beat A's ship % by ≥3 pp with no single
dim regressing >2 pp. Prefer the simpler patch when arms tie.
