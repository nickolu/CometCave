# Round 003 — re-baseline HEAD

**Date:** 2026-05-12
**HEAD:** `85b0d5c` (includes round-001 concision rule + round-002 Haiku easy-specialist guard)
**Eval config:** full sweep (51 cells) × 5 trials, judge = `gpt-4o`, concurrency 2

## Question being answered

Round 002 arm B (Haiku easy-specialist guard) hit its target (easy
+11.3 pp) but the overall ship was flat (-0.6 pp), driven by an
unexplained hard-tier regression (-10.6 pp). The guard code only runs
when `difficulty === 'easy'`, so the hard regression must be sample
noise rather than the change's effect — but a single sample isn't
proof.

This round runs HEAD (which contains the guard code) twice with fresh
samples. If both runs land near 67% overall and ~70% hard, the
hard-regression was noise and B-002 is correctly shipped. If both runs
sit at 62–65% overall, the guard is paying a real overall cost and
should be reverted.

## Comparison reference

Round-002 arm A baseline (round-001 winner code, no guard): 67.1%
overall, 71.8% hard, 76.5% medium, 52.9% easy.

Round-002 arm B (HEAD code with guard): 66.5% overall, 61.2% hard,
74.1% medium, 64.3% easy.

## Decision rule

- **Both run1 and run2 land within ±2 pp of arm-B numbers on overall
  AND hard:** the regression is real → revert B-002.
- **Either run lands within ±2 pp of arm-A's overall (≥66%) AND hard
  (≥69%):** the round-002 hard regression was noise → B-002 stays.
- **Mixed signal (one looks like A, one like B):** noise is dominating
  at this sample size. Move to 10-trial runs.

## Cost

~$5/run, ~30 min/run wall clock at concurrency 2. Total ~$10, ~1h.
Same harness as rounds 001-002.
